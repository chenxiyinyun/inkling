import { Injectable } from '@nestjs/common';
import { ReviewTargetType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { reviewText, ReviewResult } from './moderation.rules';

export { ReviewResult } from './moderation.rules';

/**
 * 内容审核服务。规则判定委托给纯函数 {@link reviewText}（见 moderation.rules.ts，便于单测），
 * 本服务只负责调度与落库。生产期可替换为可插拔的 ModerationProvider（见 docs/代码审计与迭代计划.md §3）。
 */
@Injectable()
export class ModerationService {
  constructor(private readonly prisma: PrismaService) {}

  review(text: string): ReviewResult {
    return reviewText(text);
  }

  async logReview(targetType: ReviewTargetType, targetId: string, result: ReviewResult) {
    await this.prisma.contentReview.create({
      data: { targetType, targetId, risk: result.risk, action: result.action, hits: result.hits },
    });
  }
}
