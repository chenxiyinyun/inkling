import { ReviewAction, RiskLevel } from '@prisma/client';

export interface ReviewResult {
  risk: RiskLevel;
  action: ReviewAction;
  hits: string[];
}

/**
 * MVP 本地规则审核（纯函数，无任何依赖，便于单测）。
 * ⚠️ 这是基线：生产期需接第三方多语种内容安全 API + 大模型语义 + 人工复核
 *    （见 RemoteApiProvider / docs/安全与未成年人保护.md）。高危类必须机器秒级先行拦截。
 * Phase 3 已补：归一化预处理（全角/中文数字/空格拆分/"a at b dot com"）+ 多语种词库分桶。
 */

// 联系方式（多手段对抗的最小集）
export const CONTACT_PATTERNS: Array<[RegExp, string]> = [
  [/\d{7,}/, '疑似号码'],
  [/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, '邮箱'],
  [/(https?:\/\/|www\.)\S+/i, '网址'],
  [/(微信|wechat|weixin|加我|v信|vx|加v|薇信|q\s*q|扣扣|telegram|whatsapp|line\s*id|ins|instagram)/i, '社交账号引流'],
];

/** 不友善词库——多语种分桶（便于按语言维护/扩充；匹配时拍平）。 */
export const BAD_WORDS: Record<string, string[]> = {
  zh: ['傻逼', '滚', '约炮', '婊子', '贱人'],
  en: ['fuck', 'shit', 'bitch', 'asshole'],
};

const ALL_BAD_WORDS: string[] = Object.values(BAD_WORDS).flat();

const CN_DIGITS: Record<string, string> = {
  零: '0', '〇': '0', 一: '1', 二: '2', 两: '2', 三: '3', 四: '4', 五: '5', 六: '6', 七: '7', 八: '8', 九: '9',
};

/**
 * 归一化预处理：把常见对抗手段还原成可被规则命中的形态。纯函数，可单测。
 *  ① 全角字母/数字/标点 → 半角；② 中文数字 → 阿拉伯；
 *  ③ 邮箱/网址规避还原：" at "/"艾特" → @，" dot " → .；
 * 数字间分隔符（"138 0013 8000" / "138-0013-8000"）的折叠在 reviewText 里对 compact 串处理。
 */
export function normalizeText(raw: string): string {
  let s = raw ?? '';
  // ① 全角 ASCII（！-～ = U+FF01..FF5E）→ 半角；全角空格 → 普通空格
  s = s.replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
  s = s.replace(/　/g, ' ');
  // ② 中文数字 → 阿拉伯（号码对抗）
  s = s.replace(/[零〇一二两三四五六七八九]/g, (ch) => CN_DIGITS[ch] ?? ch);
  // ③ 邮箱/网址规避还原（独立单词，避免命中 that/rate 之类）
  s = s.replace(/\s*\b(?:at|艾特)\b\s*/gi, '@');
  s = s.replace(/\s*\b(?:dot)\b\s*/gi, '.');
  return s;
}

export function reviewText(text: string): ReviewResult {
  const hits: string[] = [];
  let risk: RiskLevel = RiskLevel.SAFE;

  const normalized = normalizeText(text);
  // 折叠"数字之间"的空白/连字符/点，命中跨分隔符的号码（不影响字母间的 . 以保留邮箱）
  const compact = normalized.replace(/(?<=\d)[\s\-.]+(?=\d)/g, '');

  for (const [re, label] of CONTACT_PATTERNS) {
    if (re.test(normalized) || re.test(compact)) {
      hits.push(`contact:${label}`);
      risk = RiskLevel.HIGH;
    }
  }
  const lower = normalized.toLowerCase();
  for (const w of ALL_BAD_WORDS) {
    if (lower.includes(w.toLowerCase())) {
      hits.push(`unfriendly:${w}`);
      if (risk !== RiskLevel.HIGH) risk = RiskLevel.MEDIUM;
    }
  }

  const action =
    risk === RiskLevel.HIGH ? ReviewAction.BLOCK : risk === RiskLevel.MEDIUM ? ReviewAction.REVIEW : ReviewAction.PASS;
  return { risk, action, hits };
}
