import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReviewAction } from '@prisma/client';
import { PenpalsService } from './penpals.service';

/**
 * send() 回归测试（见 docs/代码审计与迭代计划.md §1）：
 *  - P1 拉黑后不得再发信（直接查 Block 表兜底，不依赖关系状态同步）
 *  - P0 中危 REVIEW 内容必须被拦截
 */
function makePenpals() {
  const rel = {
    id: 'r1',
    publicId: 'p1',
    userAId: 'me',
    userBId: 'partner',
    status: 'ACTIVE',
    userA: { id: 'me', publicId: 'pa', profile: { geohash5: null } },
    userB: { id: 'partner', publicId: 'pb', profile: { geohash5: null } },
  };
  const prisma: any = {
    penPalRelation: {
      findUnique: vi.fn().mockResolvedValue(rel),
      update: vi.fn().mockResolvedValue({}),
    },
    block: { findFirst: vi.fn().mockResolvedValue(null) },
    correspondence: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn(async (ops: any) => (Array.isArray(ops) ? Promise.all(ops) : ops)),
  };
  const moderation = {
    review: vi.fn(() => ({ risk: 'SAFE', action: ReviewAction.PASS, hits: [] })),
    logReview: vi.fn().mockResolvedValue(undefined),
  };
  const delivery = { correspondenceDelivery: vi.fn(() => ({ deliverAt: new Date(), vehicleLabel: '信鸽' })) };
  const service = new PenpalsService(prisma, moderation as any, delivery as any);
  return { service, prisma, moderation };
}

const DTO = { body: '最近过得怎么样？' };

describe('PenpalsService.send', () => {
  let ctx: ReturnType<typeof makePenpals>;
  beforeEach(() => {
    ctx = makePenpals();
  });

  it('正常路径：未拉黑 + 内容 PASS → 寄出', async () => {
    const res = await ctx.service.send('me', 'p1', DTO as any);
    expect(res).toMatchObject({ sent: true });
    expect(ctx.prisma.correspondence.create).toHaveBeenCalled();
  });

  it('[P1] 双方存在拉黑 → RELATION_BLOCKED，且不审核、不寄出', async () => {
    ctx.prisma.block.findFirst.mockResolvedValue({ id: 'b1' });
    await expect(ctx.service.send('me', 'p1', DTO as any)).rejects.toMatchObject({
      response: { code: 'RELATION_BLOCKED' },
    });
    expect(ctx.moderation.review).not.toHaveBeenCalled();
    expect(ctx.prisma.correspondence.create).not.toHaveBeenCalled();
  });

  it('[P0] 内容命中中危 REVIEW → CONTENT_BLOCKED，且不寄出', async () => {
    ctx.moderation.review.mockReturnValue({ risk: 'MEDIUM', action: ReviewAction.REVIEW, hits: ['unfriendly:滚'] });
    await expect(ctx.service.send('me', 'p1', DTO as any)).rejects.toMatchObject({
      response: { code: 'CONTENT_BLOCKED' },
    });
    expect(ctx.prisma.correspondence.create).not.toHaveBeenCalled();
  });
});
