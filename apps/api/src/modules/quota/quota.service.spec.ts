import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuotaService } from './quota.service';

function makeService() {
  const dailyQuota = {
    upsert: vi.fn().mockResolvedValue({ sendLeft: 1, fishLeft: 3, unsealLeft: 1 }),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  };
  const prisma = { dailyQuota } as any;
  const config = {
    get: vi.fn((k: string) => (k === 'quota' ? { send: 1, fish: 3, unseal: 1 } : undefined)),
  } as any;
  return { service: new QuotaService(prisma, config), prisma, dailyQuota };
}

describe('QuotaService.consume', () => {
  let ctx: ReturnType<typeof makeService>;
  beforeEach(() => {
    ctx = makeService();
  });

  it('原子扣减：where 含 {gt:0}，成功不抛错', async () => {
    ctx.dailyQuota.updateMany.mockResolvedValue({ count: 1 });
    await expect(ctx.service.consume('u1', 'fish')).resolves.toBeUndefined();
    expect(ctx.dailyQuota.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ fishLeft: { gt: 0 } }),
        data: { fishLeft: { decrement: 1 } },
      }),
    );
  });

  it('余额为 0（updateMany count===0）→ 抛 QUOTA_EXHAUSTED', async () => {
    ctx.dailyQuota.updateMany.mockResolvedValue({ count: 0 });
    await expect(ctx.service.consume('u1', 'unseal')).rejects.toMatchObject({
      response: { code: 'QUOTA_EXHAUSTED' },
    });
  });
});

describe('QuotaService.refund', () => {
  let ctx: ReturnType<typeof makeService>;
  beforeEach(() => {
    ctx = makeService();
  });

  it('退还前 ensureToday（防跨自然日落不到行而静默丢失）', async () => {
    await ctx.service.refund('u1', 'fish');
    expect(ctx.dailyQuota.upsert).toHaveBeenCalled();
  });

  it('clamp：仅当 field < 当日上限时 +1（fish 上限 3）', async () => {
    await ctx.service.refund('u1', 'fish');
    expect(ctx.dailyQuota.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ fishLeft: { lt: 3 } }),
        data: { fishLeft: { increment: 1 } },
      }),
    );
  });

  it('各类型用各自上限（unseal 上限 1）', async () => {
    await ctx.service.refund('u1', 'unseal');
    expect(ctx.dailyQuota.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ unsealLeft: { lt: 1 } }),
        data: { unsealLeft: { increment: 1 } },
      }),
    );
  });
});
