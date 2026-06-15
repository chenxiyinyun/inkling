import { describe, it, expect } from 'vitest';
import { ReviewAction, RiskLevel } from '@prisma/client';
import { reviewText } from './moderation.rules';

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

// 已知缺口快照（见 docs/代码审计与迭代计划.md §3）：锁定当前漏检基线，
// Phase 3 接归一化/第三方 API 后这些用例应转为命中（届时本块会失败，提醒更新）。
describe('reviewText — 已知缺口（当前漏检，待 Phase 3 修复）', () => {
  it('[已知缺口] 全角数字手机号当前漏检', () => {
    expect(reviewText('１３８００１３８０００').action).toBe(ReviewAction.PASS);
  });

  it('[已知缺口] 中文数字 / 空格拆分 / "a at b dot com" 当前漏检', () => {
    expect(reviewText('一三八零零一三八').action).toBe(ReviewAction.PASS);
    expect(reviewText('foo at bar dot com').action).toBe(ReviewAction.PASS);
  });
});
