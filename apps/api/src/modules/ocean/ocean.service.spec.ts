import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LetterStatus, ReviewAction } from '@prisma/client';
import { OceanService } from './ocean.service';

/**
 * reply() 回归测试（见 docs/代码审计与迭代计划.md §1）：
 *  - P0 拆封后回信"复活"已回池信的竞态
 *  - P0 中危 REVIEW 内容必须被拦截
 *  - P1 拉黑双方不得结缘
 * 全部用 mock prisma/redis/quota，零 DB。
 */
function makeOcean() {
  const tx = {
    letter: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    penPalRelation: { upsert: vi.fn().mockResolvedValue({ id: 'rel1', publicId: 'relpub', status: 'ACTIVE' }) },
    correspondence: { create: vi.fn().mockResolvedValue({}) },
    unsealRecord: { update: vi.fn().mockResolvedValue({}) },
  };
  const prisma: any = {
    unsealRecord: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'uns1',
        userId: 'me',
        replied: false,
        replyDeadline: new Date(Date.now() + 86_400_000),
        letterId: 'L1',
        letter: { id: 'L1', status: LetterStatus.SEALED_OPEN, authorId: 'author' },
      }),
    },
    block: { findMany: vi.fn().mockResolvedValue([]) },
    userProfile: { findUnique: vi.fn().mockResolvedValue({ geohash5: null }) },
    $transaction: vi.fn(async (cb: any) => cb(tx)),
  };
  const moderation = {
    review: vi.fn(() => ({ risk: 'SAFE', action: ReviewAction.PASS, hits: [] })),
    logReview: vi.fn().mockResolvedValue(undefined),
  };
  const delivery = { correspondenceDelivery: vi.fn(() => ({ deliverAt: new Date(), vehicleLabel: '信鸽' })) };
  const service = new OceanService(prisma, {} as any, {} as any, moderation as any, delivery as any, { get: vi.fn() } as any);
  return { service, prisma, tx, moderation };
}

const DTO = { body: '谢谢你的来信，我很喜欢。' };

describe('OceanService.reply', () => {
  let ctx: ReturnType<typeof makeOcean>;
  beforeEach(() => {
    ctx = makeOcean();
  });

  it('正常路径：SEALED_OPEN + 条件更新命中 → 结缘成功', async () => {
    const res = await ctx.service.reply('me', 'uns1', DTO as any);
    expect(res).toMatchObject({ relationId: 'relpub' });
    // 用条件更新（带 status:SEALED_OPEN 守卫）而非无条件 update
    expect(ctx.tx.letter.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: LetterStatus.SEALED_OPEN }) }),
    );
    expect(ctx.tx.penPalRelation.upsert).toHaveBeenCalled();
    expect(ctx.tx.unsealRecord.update).toHaveBeenCalled();
  });

  it('[P0] 竞态：事务内信已被回池（updateMany count===0）→ 抛错且不建立笔友关系', async () => {
    ctx.tx.letter.updateMany.mockResolvedValue({ count: 0 });
    await expect(ctx.service.reply('me', 'uns1', DTO as any)).rejects.toMatchObject({
      response: { code: 'WINDOW_CLOSED' },
    });
    expect(ctx.tx.penPalRelation.upsert).not.toHaveBeenCalled();
    expect(ctx.tx.correspondence.create).not.toHaveBeenCalled();
  });

  it('[P1] 双方已拉黑 → 抛 BLOCKED，且不进入事务', async () => {
    ctx.prisma.block.findMany.mockResolvedValue([{ userId: 'me', targetUserId: 'author' }]);
    await expect(ctx.service.reply('me', 'uns1', DTO as any)).rejects.toMatchObject({
      response: { code: 'BLOCKED' },
    });
    expect(ctx.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('[P0] 回信命中中危 REVIEW → CONTENT_BLOCKED，且不进入事务', async () => {
    ctx.moderation.review.mockReturnValue({ risk: 'MEDIUM', action: ReviewAction.REVIEW, hits: ['unfriendly:滚'] });
    await expect(ctx.service.reply('me', 'uns1', DTO as any)).rejects.toMatchObject({
      response: { code: 'CONTENT_BLOCKED' },
    });
    expect(ctx.prisma.$transaction).not.toHaveBeenCalled();
  });
});
