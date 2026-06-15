import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { LetterStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * 时间驱动状态机的"兜底巡检"（详见 docs/产品设计文档.md §6.3）。
 * MVP 以轮询保证最终一致；生产期叠加 RabbitMQ 延时队列做秒级"叫醒"。
 * 所有流转先读 DB 状态再做条件更新 → 幂等。
 */
@Injectable()
export class DeliveryScheduler {
  private readonly logger = new Logger('DeliveryScheduler');

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Cron('*/20 * * * * *') // 每 20 秒
  async tick() {
    try {
      const now = new Date();
      await this.floatArrivedLetters(now);
      await this.revertExpiredPreviewLocks(now);
      await this.recycleExpiredUnseals(now);
      await this.markDeliveredCorrespondences(now);
      await this.archiveExpiredFloating(now);
    } catch (e) {
      this.logger.error(e);
    }
  }

  /** ③在途 → ④漂入海面 */
  private async floatArrivedLetters(now: Date) {
    await this.prisma.letter.updateMany({
      where: { status: LetterStatus.DELIVERING, poolVisibleAt: { lte: now } },
      data: { status: LetterStatus.FLOATING },
    });
  }

  /** ⑤预览锁超时 → 回到 ④漂入海面 */
  private async revertExpiredPreviewLocks(now: Date) {
    const expired = await this.prisma.fishingRecord.findMany({
      where: { released: false, lockUntil: { lte: now }, letter: { status: LetterStatus.HOOKED } },
      select: { id: true, letterId: true },
      take: 200,
    });
    for (const f of expired) {
      const unsealed = await this.prisma.unsealRecord.findFirst({ where: { letterId: f.letterId } });
      if (unsealed) {
        await this.prisma.fishingRecord.update({ where: { id: f.id }, data: { released: true } });
        continue;
      }
      await this.prisma.$transaction([
        this.prisma.letter.updateMany({
          where: { id: f.letterId, status: LetterStatus.HOOKED },
          data: { status: LetterStatus.FLOATING },
        }),
        this.prisma.fishingRecord.update({ where: { id: f.id }, data: { released: true } }),
      ]);
    }
  }

  /** ⑥拆封后 7 天未回信 → 回池 / 降权 / 归档 */
  private async recycleExpiredUnseals(now: Date) {
    const maxRecycle = this.config.get<number>('letterMaxRecycle') ?? 3;
    const expired = await this.prisma.unsealRecord.findMany({
      where: { replied: false, replyDeadline: { lte: now }, letter: { status: LetterStatus.SEALED_OPEN } },
      select: { letterId: true, letter: { select: { recycleCount: true } } },
      take: 200,
    });
    for (const u of expired) {
      const nextCount = (u.letter?.recycleCount ?? 0) + 1;
      const nextStatus = nextCount >= maxRecycle ? LetterStatus.ARCHIVED : LetterStatus.FLOATING;
      await this.prisma.letter.updateMany({
        where: { id: u.letterId, status: LetterStatus.SEALED_OPEN },
        data: { status: nextStatus, recycleCount: nextCount, poolVisibleAt: now },
      });
    }
  }

  /** 笔友往来：在途 → 送达 */
  private async markDeliveredCorrespondences(now: Date) {
    await this.prisma.correspondence.updateMany({
      where: { deliveredAt: null, deliverAt: { lte: now } },
      data: { deliveredAt: now },
    });
  }

  /** 漂流到期 → 归档 */
  private async archiveExpiredFloating(now: Date) {
    await this.prisma.letter.updateMany({
      where: { status: { in: [LetterStatus.FLOATING, LetterStatus.DIMMED] }, expireAt: { lte: now } },
      data: { status: LetterStatus.ARCHIVED },
    });
  }
}
