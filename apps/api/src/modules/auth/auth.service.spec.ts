import { describe, it, expect, vi } from 'vitest';
import { AuthService } from './auth.service';

/**
 * register() 门控回归（不触 bcrypt/DB 的早返回分支）：
 *  - 缺标识符 → IDENTIFIER_REQUIRED
 *  - 低于年龄硬门控 → AGE_BELOW_FLOOR（未成年人保护红线，发生在任何写库之前）
 */
function makeAuth() {
  const prisma: any = { user: { findFirst: vi.fn(), create: vi.fn() } };
  const jwt: any = { sign: vi.fn(() => 'tok') };
  const config: any = {
    get: vi.fn((k: string) => (k === 'minAgeHardFloor' ? 13 : k === 'guardianModeBelowAge' ? 18 : undefined)),
  };
  return { service: new AuthService(prisma, jwt, config), prisma };
}

describe('AuthService.register 门控', () => {
  it('未提供邮箱/手机号 → IDENTIFIER_REQUIRED', async () => {
    const { service, prisma } = makeAuth();
    await expect(
      service.register({ password: 'x', penName: '小满', birthDate: '2000-01-01' } as any),
    ).rejects.toMatchObject({ response: { code: 'IDENTIFIER_REQUIRED' } });
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it('低于硬门控 → AGE_BELOW_FLOOR，且不查库、不建号', async () => {
    const { service, prisma } = makeAuth();
    await expect(
      service.register({ email: 'a@b.com', password: 'x', penName: '小满', birthDate: '2020-01-01' } as any),
    ).rejects.toMatchObject({ response: { code: 'AGE_BELOW_FLOOR' } });
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});
