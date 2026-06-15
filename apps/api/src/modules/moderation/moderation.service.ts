import { Injectable } from '@nestjs/common';
import { ReviewAction, ReviewTargetType, RiskLevel } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface ReviewResult {
  risk: RiskLevel;
  action: ReviewAction;
  hits: string[];
}

/**
 * MVP 本地规则审核（联系方式 + 不友好内容）。
 * ⚠️ 这是基线占位：生产期需接第三方内容安全 API + 多语种语义模型 + 人工复核，
 *    详见 docs/安全与未成年人保护.md。高危类必须机器秒级先行拦截。
 */
@Injectable()
export class ModerationService {
  constructor(private readonly prisma: PrismaService) {}

  // 联系方式（多手段对抗的最小集）
  private readonly contactPatterns: Array<[RegExp, string]> = [
    [/\b\d{7,}\b/, '疑似号码'],
    [/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, '邮箱'],
    [/(https?:\/\/|www\.)\S+/i, '网址'],
    [/(微信|wechat|weixin|加我|v信|vx|加v|薇信|q\s*q|扣扣|telegram|whatsapp|line\s*id|ins|instagram)/i, '社交账号引流'],
  ];

  private readonly badWords = ['傻逼', '滚', 'fuck', 'shit', '约炮'];

  review(text: string): ReviewResult {
    const hits: string[] = [];
    let risk: RiskLevel = RiskLevel.SAFE;

    for (const [re, label] of this.contactPatterns) {
      if (re.test(text)) {
        hits.push(`contact:${label}`);
        risk = RiskLevel.HIGH;
      }
    }
    const lower = text.toLowerCase();
    for (const w of this.badWords) {
      if (lower.includes(w.toLowerCase())) {
        hits.push(`unfriendly:${w}`);
        if (risk !== RiskLevel.HIGH) risk = RiskLevel.MEDIUM;
      }
    }

    const action =
      risk === RiskLevel.HIGH ? ReviewAction.BLOCK : risk === RiskLevel.MEDIUM ? ReviewAction.REVIEW : ReviewAction.PASS;
    return { risk, action, hits };
  }

  async logReview(targetType: ReviewTargetType, targetId: string, result: ReviewResult) {
    await this.prisma.contentReview.create({
      data: { targetType, targetId, risk: result.risk, action: result.action, hits: result.hits },
    });
  }
}
