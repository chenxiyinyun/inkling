import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { LetterStatus } from '@prisma/client';
import { createTestApp } from '../helpers/app';
import { resetDb } from '../helpers/db';
import { createLetter, createUser } from '../helpers/factory';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { DeliveryScheduler } from '../../src/modules/delivery/delivery.scheduler';

const PAST = () => new Date(Date.now() - 60_000);
const FUTURE = () => new Date(Date.now() + 30 * 86400000);

/**
 * 时间驱动状态机：用过期时间戳造数据，调真实 `scheduler.tick()`（声明式 cron 已停），
 * 断言每条流转分支。所有 fixture 互不重叠，单次 tick 各归各位。
 */
describe('时间驱动状态机 scheduler.tick()（真实 PG）', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let scheduler: DeliveryScheduler;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService, { strict: false });
    scheduler = app.get(DeliveryScheduler, { strict: false });
  });
  afterAll(async () => {
    await app?.close();
  });
  beforeEach(async () => {
    await resetDb(app);
  });

  it('在途到点 → 漂入海面 (DELIVERING → FLOATING)', async () => {
    const author = await createUser(app, {});
    const letter = await createLetter(app, author.id, {
      status: LetterStatus.DELIVERING,
      poolVisibleAt: PAST(),
      expireAt: FUTURE(),
    });
    await scheduler.tick();
    const after = await prisma.letter.findUnique({ where: { id: letter.id } });
    expect(after?.status).toBe(LetterStatus.FLOATING);
  });

  it('预览锁超时 → 回到海面，并标记打捞记录已释放', async () => {
    const author = await createUser(app, {});
    const fisher = await createUser(app, {});
    const letter = await createLetter(app, author.id, { status: LetterStatus.HOOKED, expireAt: FUTURE() });
    const f = await prisma.fishingRecord.create({
      data: { userId: fisher.id, letterId: letter.id, lockUntil: PAST(), released: false },
    });
    await scheduler.tick();
    const after = await prisma.letter.findUnique({ where: { id: letter.id } });
    expect(after?.status).toBe(LetterStatus.FLOATING);
    const fr = await prisma.fishingRecord.findUnique({ where: { id: f.id } });
    expect(fr?.released).toBe(true);
  });

  it('拆封超窗未回：未达上限 → 回池(recycleCount+1)，达上限 → 归档', async () => {
    const author = await createUser(app, {});
    const reader = await createUser(app, {});

    // 未达上限：回池为 FLOATING
    const l1 = await createLetter(app, author.id, {
      status: LetterStatus.SEALED_OPEN,
      recycleCount: 0,
      expireAt: FUTURE(),
    });
    const ur1 = await prisma.unsealRecord.create({ data: { userId: reader.id, letterId: l1.id, replyDeadline: PAST(), replied: false } });

    // 达上限（默认 3）：归档
    const l2 = await createLetter(app, author.id, {
      status: LetterStatus.SEALED_OPEN,
      recycleCount: 2,
      expireAt: FUTURE(),
    });
    const ur2 = await prisma.unsealRecord.create({ data: { userId: reader.id, letterId: l2.id, replyDeadline: PAST(), replied: false } });

    await scheduler.tick();

    const a1 = await prisma.letter.findUnique({ where: { id: l1.id } });
    expect(a1?.status).toBe(LetterStatus.FLOATING);
    expect(a1?.recycleCount).toBe(1);

    const a2 = await prisma.letter.findUnique({ where: { id: l2.id } });
    expect(a2?.status).toBe(LetterStatus.ARCHIVED);
    expect(a2?.recycleCount).toBe(3);

    // 两封信的拆封记录都被标记 recycledAt（消除旧记录永久残留 / 二次回收漂移）
    expect((await prisma.unsealRecord.findUnique({ where: { id: ur1.id } }))?.recycledAt).not.toBeNull();
    expect((await prisma.unsealRecord.findUnique({ where: { id: ur2.id } }))?.recycledAt).not.toBeNull();
  });

  it('笔友往来：在途到点 → 标记送达', async () => {
    const author = await createUser(app, {});
    const reader = await createUser(app, {});
    const letter = await createLetter(app, author.id, { status: LetterStatus.PAIRED, expireAt: FUTURE() });
    const rel = await prisma.penPalRelation.create({
      data: { userAId: author.id, userBId: reader.id, sourceLetterId: letter.id, exchangeCount: 1 },
    });
    const c = await prisma.correspondence.create({
      data: { relationId: rel.id, senderId: reader.id, body: '在途的信件正文', deliverAt: PAST(), deliveredAt: null },
    });
    await scheduler.tick();
    const after = await prisma.correspondence.findUnique({ where: { id: c.id } });
    expect(after?.deliveredAt).not.toBeNull();
  });

  it('漂流到期 → 归档 (FLOATING → ARCHIVED)', async () => {
    const author = await createUser(app, {});
    const letter = await createLetter(app, author.id, {
      status: LetterStatus.FLOATING,
      poolVisibleAt: PAST(),
      expireAt: PAST(),
    });
    await scheduler.tick();
    const after = await prisma.letter.findUnique({ where: { id: letter.id } });
    expect(after?.status).toBe(LetterStatus.ARCHIVED);
  });
});
