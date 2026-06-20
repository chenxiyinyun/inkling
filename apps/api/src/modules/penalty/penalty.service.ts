import { Injectable, Logger } from '@nestjs/common';
import { PenaltyType, UserStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

/** 累计 N 次高危内容拦截 → 自动冻结。 */
const WARNING_ESCALATE_THRESHOLD = 3;
/** 同一用户被累计 N 条待核举报 → 自动冻结待人工复核。 */
const REPORT_FREEZE_THRESHOLD = 3;
/** 自动冻结时长（小时）。 */
const FREEZE_HOURS = 72;

/**
 * 风控处罚服务：把审核/举报信号落成可执行的 Penalty + 冻结。
 * MVP 规则化自动处置（operator=AI）；申诉与人工复核见 ReportsService。
 */
@Injectable()
export class PenaltyService {
  private readonly logger = new Logger(PenaltyService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** 内容命中 BLOCK（高危）：记一条 WARNING，累计达阈值升级为 FREEZE。 */
  async recordContentBlock(userId: string, relatedReviewId?: string): Promise<void> {
    await this.prisma.penalty.create({
      data: {
        userId,
        type: PenaltyType.WARNING,
        reason: '内容审核命中高危（联系方式/不友善）',
        relatedReviewId: relatedReviewId ?? null,
      },
    });
    const warnings = await this.prisma.penalty.count({ where: { userId, type: PenaltyType.WARNING } });
    if (warnings >= WARNING_ESCALATE_THRESHOLD) {
      await this.freeze(userId, `累计 ${warnings} 次高危内容拦截，自动冻结`);
    }
  }

  /**
   * 举报累积：被「不同举报人」达阈值 → 冻结待人工复核，并把相关待核举报标记已处置。
   * 按 distinct reporterId 计数（而非原始条数），避免单个恶意用户多次举报即可冻结他人。
   */
  async recordReportAccumulation(targetUserId: string): Promise<void> {
    const reporters = await this.prisma.report.findMany({
      where: { targetUserId, status: 'OPEN' },
      select: { reporterId: true },
      distinct: ['reporterId'],
    });
    if (reporters.length >= REPORT_FREEZE_THRESHOLD) {
      const frozen = await this.freeze(targetUserId, `被 ${reporters.length} 名用户举报待核，自动冻结待人工复核`);
      if (frozen) {
        await this.prisma.report.updateMany({ where: { targetUserId, status: 'OPEN' }, data: { status: 'ACTIONED' } });
      }
    }
  }

  /** 幂等冻结：仅冻结当前 ACTIVE 用户（已冻结/封禁不重复处置）。 */
  private async freeze(userId: string, reason: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
    if (!user || user.status !== UserStatus.ACTIVE) return false;
    const endsAt = new Date(Date.now() + FREEZE_HOURS * 3_600_000);
    await this.prisma.$transaction([
      this.prisma.penalty.create({ data: { userId, type: PenaltyType.FREEZE, reason, endsAt } }),
      this.prisma.user.update({ where: { id: userId }, data: { status: UserStatus.FROZEN, frozenUntil: endsAt } }),
    ]);
    this.logger.warn(`用户 ${userId} 已自动冻结至 ${endsAt.toISOString()}：${reason}`);
    return true;
  }
}
