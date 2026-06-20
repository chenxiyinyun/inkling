import { describe, it, expect } from 'vitest';
import { ReviewAction, RiskLevel } from '@prisma/client';
import { reviewText, normalizeText } from './moderation.rules';

describe('reviewText — 干净内容', () => {
  it('普通中文 → SAFE / PASS / 无命中', () => {
    const r = reviewText('今天天气很好，想和你聊聊最近读过的一本书。');
    expect(r.risk).toBe(RiskLevel.SAFE);
    expect(r.action).toBe(ReviewAction.PASS);
    expect(r.hits).toEqual([]);
  });
});

describe('reviewText — 联系方式（高危，秒级拦截）', () => {
  it('手机号 → HIGH / BLOCK', () => {
    const r = reviewText('加我电话13800138000');
    expect(r.risk).toBe(RiskLevel.HIGH);
    expect(r.action).toBe(ReviewAction.BLOCK);
    expect(r.hits.some((h) => h.startsWith('contact:'))).toBe(true);
  });

  it('邮箱 → HIGH / BLOCK', () => {
    expect(reviewText('我的邮箱 foo@bar.com').action).toBe(ReviewAction.BLOCK);
  });

  it('网址 → HIGH / BLOCK', () => {
    expect(reviewText('看这里 www.example.com').action).toBe(ReviewAction.BLOCK);
  });

  it('社交引流（微信/vx 等）→ HIGH / BLOCK', () => {
    expect(reviewText('加我微信聊').action).toBe(ReviewAction.BLOCK);
    expect(reviewText('vx同号').action).toBe(ReviewAction.BLOCK);
  });
});

describe('reviewText — 不友善内容', () => {
  it('脏词 → MEDIUM / REVIEW', () => {
    const r = reviewText('你给我滚');
    expect(r.risk).toBe(RiskLevel.MEDIUM);
    expect(r.action).toBe(ReviewAction.REVIEW);
    expect(r.hits.some((h) => h.startsWith('unfriendly:'))).toBe(true);
  });

  it('HIGH 不被 MEDIUM 覆盖（联系方式 + 脏词 → HIGH/BLOCK）', () => {
    const r = reviewText('滚，加微信 foo@bar.com');
    expect(r.risk).toBe(RiskLevel.HIGH);
    expect(r.action).toBe(ReviewAction.BLOCK);
  });
});

// Phase 3 归一化预处理：原"已知缺口"现已转为命中（对抗手段被还原后拦截）。
describe('reviewText — 归一化后命中对抗手段（Phase 3）', () => {
  it('全角数字手机号 → BLOCK', () => {
    expect(reviewText('１３８００１３８０００').action).toBe(ReviewAction.BLOCK);
  });

  it('中文数字号码 → BLOCK', () => {
    expect(reviewText('一三八零零一三八零零零').action).toBe(ReviewAction.BLOCK);
  });

  it('空格 / 连字符拆分的号码 → BLOCK', () => {
    expect(reviewText('打我 138 0013 8000').action).toBe(ReviewAction.BLOCK);
    expect(reviewText('138-0013-8000').action).toBe(ReviewAction.BLOCK);
  });

  it('"a at b dot com" 邮箱规避 → BLOCK', () => {
    expect(reviewText('foo at bar dot com').action).toBe(ReviewAction.BLOCK);
  });

  it('英文脏词（多语种桶）→ REVIEW', () => {
    expect(reviewText('this is bullshit, you bitch').action).toBe(ReviewAction.REVIEW);
  });

  it('正常含"at"的英文句子不误伤（无 TLD 不构成邮箱）', () => {
    expect(reviewText('I sat at home reading a good book').action).toBe(ReviewAction.PASS);
  });
});

describe('normalizeText 归一化', () => {
  it('全角字母数字标点 → 半角', () => {
    expect(normalizeText('ＡＢＣ１２３＠．')).toBe('ABC123@.');
  });
  it('中文数字 → 阿拉伯', () => {
    expect(normalizeText('一三八零')).toBe('1380');
  });
  it('" at "/" dot " 还原为 @ / .', () => {
    expect(normalizeText('foo at bar dot com')).toBe('foo@bar.com');
  });
  it('不还原单词内部的 at（that/rate 等）', () => {
    expect(normalizeText('that rate is great')).toBe('that rate is great');
  });
});
