import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { LetterStatus, NotificationType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * 时间驱动状态机的"兜底巡检"（详见 docs/产品设计文档.md §6.3）。
 * MVP 以轮询保证最终一致；生产期叠加 RabbitMQ 延时队列做秒级"叫醒"。
 * 所有流转先读 DB 状态再做条件更新 → 幂等；通知仅在「本 tick 真实发生流转」时发出（count===1），
 * 故 20s 重跑不会重复通知（窗口预警另用 warnedAt 去重）。
 */
@Injectable()
export class DeliveryScheduler {
  private readonly logger = new Logger('DeliveryScheduler');

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron('*/20 * * * * *') // 每 20 秒
  async tick() {
    try {
      const now = new Date();
      await this.floatArrivedLetters(now);
      await this.revertExpiredPreviewLocks(now);
      await this.warnExpiringUnseals(now);
      await this.recycleExpiredUnseals(now);
      await this.markDeliveredCorrespondences(now);
      await this.archiveExpiredFloating(now);
    } catch (e) {
      this.logger.error(e);
    }
  }

  /** 通知 best-effort：失败只记日志，绝不影响状态流转。 */
  private async notify(userId: string, type: NotificationType, title: string, ref: Record<string, unknown>) {
    try {
      await this.notifications.create(userId, type, title, ref);
    } catch (e) {
      this.logger.error(`通知发送失败 ${type} → ${userId}: ${e}`);
    }
  }

  /** ③在途 → ④漂入海面（到点通知作者） */
  private async floatArrivedLetters(now: Date) {
    const arrived = await this.prisma.letter.findMany({
      where: { status: LetterStatus.DELIVERING, poolVisibleAt: { lte: now } },
      select: { id: true, publicId: true, authorId: true },
      take: 200,
    });
    for (const l of arrived) {
      const res = await this.prisma.letter.updateMany({
        where: { id: l.id, status: LetterStatus.DELIVERING },
        data: { status: LetterStatus.FLOATING },
      });
      if (res.count === 1) {
        await this.notify(l.authorId, NotificationType.LETTER_DELIVERED, '你的信已漂入海面，静待有缘人拾起', {
          letterPublicId: l.publicId,
        });
      }
    }
  }

  /** ⑤预览锁超时 → 回到 ④漂入海面 */
  private async revertExpiredPreviewLocks(now: Date) {
    const expired = await this.prisma.fishingRecord.findMany({
      where: { released: false, lockUntil: { lte: now }, letter: { status: LetterStatus.HOOKED } },
      select: { id: true, letterId: true },
      take: 200,
    });
    // 仅处理仍 HOOKED 的预览锁——已拆封的信是 SEALED_OPEN，不会进入此列表，
    // 故无需再判断是否存在 unsealRecord（原分支为死代码，已移除）。
    for (const f of expired) {
      await this.prisma.$transaction([
        this.prisma.letter.updateMany({
          where: { id: f.letterId, status: LetterStatus.HOOKED },
          data: { status: LetterStatus.FLOATING },
        }),
        this.prisma.fishingRecord.update({ where: { id: f.id }, data: { released: true } }),
      ]);
    }
  }

  /** 回信窗口剩 ≤24h → 发一次温和预警（warnedAt 去重，防 20s 重复） */
  private async warnExpiringUnseals(now: Date) {
    const soon = new Date(now.getTime() + 24 * 3_600_000);
    const expiring = await this.prisma.unsealRecord.findMany({
      where: { replied: false, recycledAt: null, warnedAt: null, replyDeadline: { gt: now, lte: soon } },
      select: { id: true, userId: true, replyDeadline: true, letter: { select: { publicId: true } } },
      take: 200,
    });
    for (const u of expiring) {
      const res = await this.prisma.unsealRecord.updateMany({
        where: { id: u.id, warnedAt: null, replied: false, recycledAt: null },
        data: { warnedAt: now },
      });
      if (res.count === 1) {
        await this.notify(u.userId, NotificationType.UNSEAL_REPLY_WINDOW_WARNING, '你拆封的信，回信窗口剩不到一天了', {
          letterPublicId: u.letter?.publicId,
          daysLeft: Math.max(0, Math.ceil((u.replyDeadline.getTime() - now.getTime()) / 86_400_000)),
        });
      }
    }
  }

  /** ⑥拆封后 7 天未回信 → 回池 / 降权 / 归档（通知拆封者，温和文案） */
  private async recycleExpiredUnseals(now: Date) {
    const maxRecycle = this.config.get<number>('letterMaxRecycle') ?? 3;
    const expired = await this.prisma.unsealRecord.findMany({
      // recycledAt: null —— 已回收的拆封记录不再重复处理（消除"旧记录永久残留/二次回收"漂移）
      where: { replied: false, recycledAt: null, replyDeadline: { lte: now }, letter: { status: LetterStatus.SEALED_OPEN } },
      select: { id: true, userId: true, letterId: true, letter: { select: { recycleCount: true, publicId: true } } },
      take: 200,
    });
    for (const u of expired) {
      const nextCount = (u.letter?.recycleCount ?? 0) + 1;
      const nextStatus = nextCount >= maxRecycle ? LetterStatus.ARCHIVED : LetterStatus.FLOATING;
      // 回池/归档信件的同时标记本次拆封已回收：原子事务 + 条件守卫，
      // 与「回信结缘」存在竞态时两条 updateMany 均 count=0（信已 PAIRED / 拆封已 replied），故不会误标。
      const [, marked] = await this.prisma.$transaction([
        this.prisma.letter.updateMany({
          where: { id: u.letterId, status: LetterStatus.SEALED_OPEN },
          data: { status: nextStatus, recycleCount: nextCount, poolVisibleAt: now },
        }),
        this.prisma.unsealRecord.updateMany({
          where: { id: u.id, replied: false, recycledAt: null },
          data: { recycledAt: now },
        }),
      ]);
      if (marked.count === 1) {
        await this.notify(u.userId, NotificationType.UNSEAL_EXPIRED_REDRIFT, '你拆封的信回信窗口已过，它重新漂回了海面', {
          letterPublicId: u.letter?.publicId,
        });
      }
    }
  }

  /** 笔友往来：在途 → 送达（通知收信方） */
  private async markDeliveredCorrespondences(now: Date) {
    const arrived = await this.prisma.correspondence.findMany({
      where: { deliveredAt: null, deliverAt: { lte: now } },
      select: {
        id: true,
        senderId: true,
        body: true,
        relation: { select: { publicId: true, userAId: true, userBId: true } },
      },
      take: 200,
    });
    for (const c of arrived) {
      const res = await this.prisma.correspondence.updateMany({
        where: { id: c.id, deliveredAt: null },
        data: { deliveredAt: now },
      });
      if (res.count === 1) {
        const recipientId = c.senderId === c.relation.userAId ? c.relation.userBId : c.relation.userAId;
        await this.notify(recipientId, NotificationType.PENPAL_REPLY_ARRIVED, '笔友的回信抵达了', {
          relationPublicId: c.relation.publicId,
          previewExcerpt: c.body.slice(0, 24),
        });
      }
    }
  }

  /** 漂流到期 → 归档 */
  private async archiveExpiredFloating(now: Date) {
    await this.prisma.letter.updateMany({
      where: { status: { in: [LetterStatus.FLOATING, LetterStatus.DIMMED] }, expireAt: { lte: now } },
      data: { status: LetterStatus.ARCHIVED },
    });
  }
}
