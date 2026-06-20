import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { PenaltyType, UserStatus } from '@prisma/client';
import { createTestApp } from '../helpers/app';
import { resetDb } from '../helpers/db';
import { http, registerAdult, CLEAN_LETTER } from '../helpers/http';
import { PrismaService } from '../../src/common/prisma/prisma.service';

// >50 字且含联系方式（微信 + 号码）→ 归一化后命中 HIGH → BLOCK
const BLOCK_LETTER =
  '你好呀很高兴在漂流海里遇见你想认识你做个长久的朋友，方便的话加我微信13800138000一起慢慢聊生活的点滴好不好呀。';

describe('风控闭环 + GDPR e2e（真实 PG）', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService, { strict: false });
  });
  afterAll(async () => {
    await app?.close();
  });
  beforeEach(async () => {
    await resetDb(app);
  });

  it('内容命中 BLOCK → CONTENT_BLOCKED，并自动记一条 WARNING 处罚', async () => {
    const u = await registerAdult(app);
    const res = await http(app)
      .post('/v1/letters/compose')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ body: BLOCK_LETTER })
      .expect(400);
    expect(res.body.error.code).toBe('CONTENT_BLOCKED');

    const dbUser = await prisma.user.findUnique({ where: { publicId: u.publicId } });
    const penalties = await prisma.penalty.findMany({ where: { userId: dbUser!.id } });
    expect(penalties.some((p) => p.type === PenaltyType.WARNING)).toBe(true);
  });

  it('累计 3 次 BLOCK → 自动冻结，且登录被拦 (ACCOUNT_FROZEN)', async () => {
    const u = await registerAdult(app);
    for (let i = 0; i < 3; i++) {
      await http(app).post('/v1/letters/compose').set('Authorization', `Bearer ${u.token}`).send({ body: BLOCK_LETTER }).expect(400);
    }
    const dbUser = await prisma.user.findUnique({ where: { publicId: u.publicId } });
    expect(dbUser!.status).toBe(UserStatus.FROZEN);
    expect(dbUser!.frozenUntil).not.toBeNull();

    const login = await http(app).post('/v1/auth/login').send({ email: u.email, password: 'password123' }).expect(403);
    expect(login.body.error.code).toBe('ACCOUNT_FROZEN');
  });

  it('冻结到期 → 登录自动解冻放行', async () => {
    const u = await registerAdult(app);
    const dbUser = await prisma.user.findUnique({ where: { publicId: u.publicId } });
    await prisma.user.update({
      where: { id: dbUser!.id },
      data: { status: UserStatus.FROZEN, frozenUntil: new Date(Date.now() - 1000) },
    });
    const login = await http(app).post('/v1/auth/login').send({ email: u.email, password: 'password123' }).expect(201);
    expect(login.body.data.accessToken).toBeTruthy();
    const after = await prisma.user.findUnique({ where: { id: dbUser!.id } });
    expect(after!.status).toBe(UserStatus.ACTIVE);
    expect(after!.frozenUntil).toBeNull();
  });

  it('举报累积达阈值 → 被举报者自动冻结', async () => {
    const target = await registerAdult(app);
    for (let i = 0; i < 3; i++) {
      const reporter = await registerAdult(app);
      await http(app)
        .post('/v1/reports')
        .set('Authorization', `Bearer ${reporter.token}`)
        .send({ targetPublicId: target.publicId, reason: 'HARASSMENT' })
        .expect(201);
    }
    const dbTarget = await prisma.user.findUnique({ where: { publicId: target.publicId } });
    expect(dbTarget!.status).toBe(UserStatus.FROZEN);
  });

  it('申诉落表：POST /appeals 持久化并返回 appealId/OPEN', async () => {
    const u = await registerAdult(app);
    const res = await http(app)
      .post('/v1/appeals')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ targetType: 'penalty', targetId: 'pn_demo', reason: '误判，我并未发送联系方式，请人工复核。' })
      .expect(201);
    expect(res.body.data.appealId).toBeTruthy();
    expect(res.body.data.status).toBe('OPEN');

    const dbUser = await prisma.user.findUnique({ where: { publicId: u.publicId } });
    const appeals = await prisma.appeal.findMany({ where: { userId: dbUser!.id } });
    expect(appeals.length).toBe(1);
    expect(appeals[0].reason).toContain('复核');
  });

  it('GDPR 全量导出：含信件正文与账号结构化数据', async () => {
    const u = await registerAdult(app, { penName: '导出测试' });
    await http(app).post('/v1/letters/compose').set('Authorization', `Bearer ${u.token}`).send({ body: CLEAN_LETTER }).expect(201);

    const res = await http(app).post('/v1/me/export').set('Authorization', `Bearer ${u.token}`).expect(201);
    const data = res.body.data;
    expect(data.account.publicId).toBe(u.publicId);
    expect(data.exportedAt).toBeTruthy();
    expect(Array.isArray(data.letters)).toBe(true);
    expect(data.letters[0].body).toBe(CLEAN_LETTER);
    expect(Array.isArray(data.penpals)).toBe(true);
  });
});
