import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { HttpException, type INestApplication } from '@nestjs/common';
import { LetterStatus } from '@prisma/client';
import { createTestApp } from '../helpers/app';
import { resetDb } from '../helpers/db';
import { createLetter, createUser, ensureQuotaRow } from '../helpers/factory';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { OceanService } from '../../src/modules/ocean/ocean.service';
import { QuotaService } from '../../src/modules/quota/quota.service';

/** 从被拒 Promise 里取业务错误码（Nest 异常 body 为 { code, message }，走公开的 getResponse()）。 */
function codeOf(r: PromiseSettledResult<unknown>): string | undefined {
  if (r.status !== 'rejected') return undefined;
  const e = r.reason;
  if (!(e instanceof HttpException)) return undefined;
  const body = e.getResponse();
  return typeof body === 'object' && body !== null ? (body as { code?: string }).code : undefined;
}

/**
 * 并发安全：纯 mock 测不出的原子/竞态语义，必须打真实 PG + Redis。
 * 覆盖 ①拆封唯一性 ②配额原子扣减不成负 ③打捞认领唯一性。
 */
describe('并发安全（真实 PG + Redis）', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ocean: OceanService;
  let quota: QuotaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService, { strict: false });
    ocean = app.get(OceanService, { strict: false });
    quota = app.get(QuotaService, { strict: false });
  });
  afterAll(async () => {
    await app?.close();
  });
  beforeEach(async () => {
    await resetDb(app);
  });

  it('拆封唯一性：两人争拆同一封 HOOKED 信，仅一人成功，输家配额退还', async () => {
    const author = await createUser(app, { penName: '作者' });
    const u1 = await createUser(app, { penName: '甲' });
    const u2 = await createUser(app, { penName: '乙' });
    const letter = await createLetter(app, author.id, { status: LetterStatus.HOOKED });

    // 同一封 HOOKED 信上，两人各有一条打捞记录（@@unique([userId,letterId]) 允许不同用户）
    const lockUntil = new Date(Date.now() + 600000);
    const f1 = await prisma.fishingRecord.create({ data: { userId: u1.id, letterId: letter.id, lockUntil } });
    const f2 = await prisma.fishingRecord.create({ data: { userId: u2.id, letterId: letter.id, lockUntil } });

    const results = await Promise.allSettled([ocean.unseal(u1.id, f1.id), ocean.unseal(u2.id, f2.id)]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected');

    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(['UNSEAL_BUSY', 'UNSEAL_FAILED']).toContain(codeOf(failed[0]));

    // 只产生一条拆封记录，信变 SEALED_OPEN
    expect(await prisma.unsealRecord.count({ where: { letterId: letter.id } })).toBe(1);
    const after = await prisma.letter.findUnique({ where: { id: letter.id } });
    expect(after?.status).toBe(LetterStatus.SEALED_OPEN);

    // 赢家拆封配额 1→0；输家扣后退还回 1
    const q1 = await prisma.dailyQuota.findFirst({ where: { userId: u1.id } });
    const q2 = await prisma.dailyQuota.findFirst({ where: { userId: u2.id } });
    expect([q1?.unsealLeft, q2?.unsealLeft].sort()).toEqual([0, 1]);
  });

  it('配额原子性：10 路并发扣减恰好成功上限次、绝不成负', async () => {
    const user = await createUser(app, {});
    await ensureQuotaRow(app, user.id, { fish: 3 }); // 预建行，隔离出"扣减原子性"本身

    const attempts = await Promise.allSettled(
      Array.from({ length: 10 }, () => quota.consume(user.id, 'fish')),
    );
    const ok = attempts.filter((r) => r.status === 'fulfilled').length;
    const exhausted = attempts.filter((r) => codeOf(r) === 'QUOTA_EXHAUSTED').length;

    expect(ok).toBe(3);
    expect(exhausted).toBe(7);
    const q = await prisma.dailyQuota.findFirst({ where: { userId: user.id } });
    expect(q?.fishLeft).toBe(0); // 关键：绝不为负
  });

  it('打捞认领唯一性：一封信被多人同时打捞，仅一人捞到', async () => {
    const author = await createUser(app, { penName: '作者' });
    const letter = await createLetter(app, author.id, { status: LetterStatus.FLOATING });
    const fishers = await Promise.all(
      Array.from({ length: 5 }, (_, i) => createUser(app, { penName: `捞${i}` })),
    );
    // 预建配额行，避免 ensureToday 并发插入竞态干扰（我们测的是认领 CAS）
    await Promise.all(fishers.map((f) => ensureQuotaRow(app, f.id, { fish: 3 })));

    const results = await Promise.allSettled(fishers.map((f) => ocean.fish(f.id)));
    const ok = results.filter((r) => r.status === 'fulfilled');

    expect(ok).toHaveLength(1);
    expect(await prisma.fishingRecord.count({ where: { letterId: letter.id } })).toBe(1);
    const after = await prisma.letter.findUnique({ where: { id: letter.id } });
    expect(after?.status).toBe(LetterStatus.HOOKED);

    // 失败方错误码 ∈ {OCEAN_EMPTY（捞时已无候选）, OCEAN_BUSY（抢锁全败）}
    for (const r of results.filter((x) => x.status === 'rejected')) {
      expect(['OCEAN_EMPTY', 'OCEAN_BUSY']).toContain(codeOf(r));
    }
  });
});
