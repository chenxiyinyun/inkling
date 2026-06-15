import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LetterStatus, ReviewAction } from '@prisma/client';
import { LettersService } from './letters.service';

/**
 * submit() 回归测试（见 docs/代码审计与迭代计划.md §1）：
 *  - P0 中危 REVIEW 内容必须被拦截，且拦截发生在扣投递配额之前。
 */
function makeLetters() {
  const prisma: any = {
    letter: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'L1',
        publicId: 'p1',
        authorId: 'me',
        status: LetterStatus.DRAFT,
        body: '这是一封想认真写给陌生人的信。',
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    previewSnapshot: { upsert: vi.fn().mockResolvedValue({}) },
    userProfile: { findUnique: vi.fn().mockResolvedValue({ interestTags: [], mbti: 'UNKNOWN', geohash5: null }) },
    $transaction: vi.fn(async (ops: any) => (Array.isArray(ops) ? Promise.all(ops) : ops)),
  };
  const moderation = {
    review: vi.fn(() => ({ risk: 'SAFE', action: ReviewAction.PASS, hits: [] })),
    logReview: vi.fn().mockResolvedValue(undefined),
  };
  const quota = { consume: vi.fn().mockResolvedValue(undefined) };
  const delivery = { poolVisibleAt: vi.fn(() => new Date()), expireAt: vi.fn(() => new Date()) };
  const service = new LettersService(prisma, moderation as any, quota as any, delivery as any);
  return { service, prisma, moderation, quota };
}

describe('LettersService.submit', () => {
  let ctx: ReturnType<typeof makeLetters>;
  beforeEach(() => {
    ctx = makeLetters();
  });

  it('正常路径：内容 PASS → 扣配额 + 入途，返回 DELIVERING', async () => {
    const res = await ctx.service.submit('me', 'p1');
    expect(res).toMatchObject({ status: LetterStatus.DELIVERING });
    expect(ctx.quota.consume).toHaveBeenCalledWith('me', 'send');
    expect(ctx.prisma.$transaction).toHaveBeenCalled();
  });

  it('[P0] 中危 REVIEW → CONTENT_BLOCKED，且不扣投递配额', async () => {
    ctx.moderation.review.mockReturnValue({ risk: 'MEDIUM', action: ReviewAction.REVIEW, hits: ['unfriendly:滚'] });
    await expect(ctx.service.submit('me', 'p1')).rejects.toMatchObject({
      response: { code: 'CONTENT_BLOCKED' },
    });
    expect(ctx.quota.consume).not.toHaveBeenCalled();
  });

  it('高危 BLOCK → CONTENT_BLOCKED，且不扣投递配额', async () => {
    ctx.moderation.review.mockReturnValue({ risk: 'HIGH', action: ReviewAction.BLOCK, hits: ['contact:邮箱'] });
    await expect(ctx.service.submit('me', 'p1')).rejects.toMatchObject({
      response: { code: 'CONTENT_BLOCKED' },
    });
    expect(ctx.quota.consume).not.toHaveBeenCalled();
  });
});
