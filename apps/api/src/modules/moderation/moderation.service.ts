import { Inject, Injectable } from '@nestjs/common';
import { ReviewTargetType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ReviewResult } from './moderation.rules';
import { MODERATION_PROVIDER, ModerationProvider } from './moderation.provider';

export { ReviewResult } from './moderation.rules';

/**
 * 内容审核服务。判定委托给可插拔的 {@link ModerationProvider}（env 切换 local/remote），
 * 本服务只负责调度与落库审计。
 */
@Injectable()
export class ModerationService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(MODERATION_PROVIDER) private readonly provider: ModerationProvider,
  ) {}

  review(text: string): Promise<ReviewResult> {
    return this.provider.review(text);
  }

  /** 落审计表，并返回 ContentReview.id 供风控（自动 Penalty）关联 relatedReviewId。 */
  async logReview(targetType: ReviewTargetType, targetId: string, result: ReviewResult): Promise<string> {
    const row = await this.prisma.contentReview.create({
      data: { targetType, targetId, risk: result.risk, action: result.action, hits: result.hits },
      select: { id: true },
    });
    return row.id;
  }
}
