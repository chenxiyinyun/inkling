import { ReviewAction, RiskLevel } from '@prisma/client';

export interface ReviewResult {
  risk: RiskLevel;
  action: ReviewAction;
  hits: string[];
}

/**
 * MVP 本地规则审核（纯函数，无任何依赖，便于单测）。
 * ⚠️ 这是基线占位：生产期需接第三方内容安全 API + 多语种语义模型 + 人工复核，
 *    详见 docs/安全与未成年人保护.md。高危类必须机器秒级先行拦截。
 * 已知缺口（待 Phase 3 增强，见 docs/代码审计与迭代计划.md §3）：
 *   谐音 / 全角数字 / 空格拆分 / "a at b dot com" / 多语种词库均尚未覆盖。
 */

// 联系方式（多手段对抗的最小集）
export const CONTACT_PATTERNS: Array<[RegExp, string]> = [
  [/\b\d{7,}\b/, '疑似号码'],
  [/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, '邮箱'],
  [/(https?:\/\/|www\.)\S+/i, '网址'],
  [/(微信|wechat|weixin|加我|v信|vx|加v|薇信|q\s*q|扣扣|telegram|whatsapp|line\s*id|ins|instagram)/i, '社交账号引流'],
];

export const BAD_WORDS = ['傻逼', '滚', 'fuck', 'shit', '约炮'];

export function reviewText(text: string): ReviewResult {
  const hits: string[] = [];
  let risk: RiskLevel = RiskLevel.SAFE;

  for (const [re, label] of CONTACT_PATTERNS) {
    if (re.test(text)) {
      hits.push(`contact:${label}`);
      risk = RiskLevel.HIGH;
    }
  }
  const lower = text.toLowerCase();
  for (const w of BAD_WORDS) {
    if (lower.includes(w.toLowerCase())) {
      hits.push(`unfriendly:${w}`);
      if (risk !== RiskLevel.HIGH) risk = RiskLevel.MEDIUM;
    }
  }

  const action =
    risk === RiskLevel.HIGH ? ReviewAction.BLOCK : risk === RiskLevel.MEDIUM ? ReviewAction.REVIEW : ReviewAction.PASS;
  return { risk, action, hits };
}
