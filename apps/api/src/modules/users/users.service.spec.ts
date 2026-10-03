import { describe, it, expect, vi } from 'vitest';
import { UsersService } from './users.service';

/** 删除请求执行器：关键写操作的回归（mock prisma / tx，不碰真库）。 */
function makeService() {
  const tx = {
    user: { updateMany: vi.fn(async () => ({ count: 1 })) },
    userProfile: { updateMany: vi.fn(async () => ({ count: 1 })) },
    letter: { updateMany: vi.fn(async () => ({ count: 1 })) },
    penPalRelation: { updateMany: vi.fn(async () => ({ count: 1 })) },
    parentalConsent: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    notification: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    block: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    dataDeletionRequest: { update: vi.fn(async () => ({})) },
  };
  const prisma: any = {
    dataDeletionRequest: {
      findMany: vi.fn(async () => [{ id: 'req1', userId: 'u1', status: 'PENDING' }]),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    $transaction: vi.fn(async (fn: any) => fn(tx)),
  };
  return { service: new UsersService(prisma), prisma, tx };
}

describe('UsersService.processDeletionRequests', () => {
  it('认领后执行匿名化：置 DELETED、抹除 PII、归档漂流信、登记置 DONE', async () => {
    const { service, prisma, tx } = makeService();
    const n = await service.processDeletionRequests();
    expect(n).toBe(1);

    expect(prisma.dataDeletionRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'PROCESSING' } }),
    );

    const userUpdate = tx.user.updateMany.mock.calls[0][0];
    expect(userUpdate.data.status).toBe('DELETED');
    expect(userUpdate.data.email).toBeNull();
    expect(userUpdate.data.phone).toBeNull();
    expect(typeof userUpdate.data.passwordHash).toBe('string');

    const profileUpdate = tx.userProfile.updateMany.mock.calls[0][0];
    expect(profileUpdate.data.penName).toBe('已注销的旅人');
    expect(profileUpdate.data.geohash5).toBeNull();

    expect(tx.letter.updateMany).toHaveBeenCalled();
    expect(tx.penPalRelation.updateMany).toHaveBeenCalled();
    expect(tx.dataDeletionRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'DONE' }) }),
    );
  });

  it('认领失败（已被其他实例处理）则跳过，不做任何写入', async () => {
    const { service, prisma, tx } = makeService();
    prisma.dataDeletionRequest.updateMany.mockResolvedValueOnce({ count: 0 });
    const n = await service.processDeletionRequests();
    expect(n).toBe(0);
    expect(tx.user.updateMany).not.toHaveBeenCalled();
  });
});

describe('UsersService.requestDeletion 幂等', () => {
  it('已有进行中的请求时不重复登记', async () => {
    const prisma: any = {
      dataDeletionRequest: { findFirst: vi.fn(async () => ({ id: 'x' })), create: vi.fn() },
    };
    const service = new UsersService(prisma);
    await service.requestDeletion('u1');
    expect(prisma.dataDeletionRequest.create).not.toHaveBeenCalled();
  });

  it('无进行中请求时登记一条', async () => {
    const prisma: any = {
      dataDeletionRequest: { findFirst: vi.fn(async () => null), create: vi.fn(async () => ({})) },
    };
    const service = new UsersService(prisma);
    await service.requestDeletion('u1');
    expect(prisma.dataDeletionRequest.create).toHaveBeenCalledWith({ data: { userId: 'u1' } });
  });
});
