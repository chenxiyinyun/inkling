import { describe, it, expect, vi } from 'vitest';
import { AuthService } from './auth.service';

/** register() 门控回归（不触 bcrypt/DB 的早返回分支）：缺标识符 → IDENTIFIER_REQUIRED。 */
function makeAuth() {
  const prisma: any = { user: { findFirst: vi.fn(), create: vi.fn() } };
  const jwt: any = { sign: vi.fn(() => 'tok') };
  const config: any = { get: vi.fn(() => undefined) };
  return { service: new AuthService(prisma, jwt, config), prisma };
}

describe('AuthService.register 门控', () => {
  it('未提供邮箱/手机号 → IDENTIFIER_REQUIRED，且不查库', async () => {
    const { service, prisma } = makeAuth();
    await expect(service.register({ password: 'x', penName: '小满' } as any)).rejects.toMatchObject({
      response: { code: 'IDENTIFIER_REQUIRED' },
    });
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });
});
