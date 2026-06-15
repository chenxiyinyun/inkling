import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';

export type QuotaKind = 'send' | 'fish' | 'unseal';

@Injectable()
export class QuotaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private today(): string {
    return new Date().toISOString().slice(0, 10); // UTC 自然日
  }

  private resetsAt(): string {
    const d = new Date();
    d.setUTCHours(24, 0, 0, 0);
    return d.toISOString();
  }

  async ensureToday(userId: string) {
    const date = this.today();
    const q = this.config.get<{ send: number; fish: number; unseal: number }>('quota')!;
    return this.prisma.dailyQuota.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date, sendLeft: q.send, fishLeft: q.fish, unsealLeft: q.unseal },
      update: {},
    });
  }

  async getToday(userId: string) {
    const row = await this.ensureToday(userId);
    return { send: row.sendLeft, fish: row.fishLeft, unseal: row.unsealLeft, resetsAt: this.resetsAt() };
  }

  /** 原子扣减；不足则抛错。返回扣减后剩余。 */
  async consume(userId: string, kind: QuotaKind): Promise<void> {
    await this.ensureToday(userId);
    const date = this.today();
    const field = `${kind}Left` as const;
    const res = await this.prisma.dailyQuota.updateMany({
      where: { userId, date, [field]: { gt: 0 } },
      data: { [field]: { decrement: 1 } },
    });
    if (res.count === 0) {
      const msg =
        kind === 'send' ? '今日漂流瓶已用尽，明日潮汐再启' : kind === 'fish' ? '今日打捞次数已用尽' : '今日只能拆一封信，明天再来';
      throw new ForbiddenException({ code: 'QUOTA_EXHAUSTED', message: msg });
    }
  }

  /**
   * 退还（用于操作回滚）。
   * 仅当当前余额低于当日上限时 +1（clamp，防重复退还涨破上限）；
   * 先 ensureToday，避免跨自然日退还落不到行而静默丢失。
   */
  async refund(userId: string, kind: QuotaKind): Promise<void> {
    await this.ensureToday(userId);
    const date = this.today();
    const field = `${kind}Left` as const;
    const q = this.config.get<{ send: number; fish: number; unseal: number }>('quota')!;
    const cap = q[kind];
    await this.prisma.dailyQuota.updateMany({
      where: { userId, date, [field]: { lt: cap } },
      data: { [field]: { increment: 1 } },
    });
  }
}
