import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { LetterStatus } from '@prisma/client';
import { createTestApp } from '../helpers/app';
import { resetDb } from '../helpers/db';
import { http, registerAdult, CLEAN_LETTER, CLEAN_REPLY } from '../helpers/http';
import { PrismaService } from '../../src/common/prisma/prisma.service';

/**
 * 核心循环 e2e（真机管线 + 真实 PG/Redis）：
 * 注册(年龄门控) → 写信(审核→在途) → 入海 → 打捞 → 拆封 → 7 天内回信 → 结缘成笔友。
 */
describe('信件核心循环 e2e', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app?.close();
  });
  beforeEach(async () => {
    await resetDb(app);
  });

  it('鉴权：缺 token 访问受保护端点 → 401', async () => {
    await http(app).get('/v1/me').expect(401);
  });

  it('年龄硬门控：未满 13 岁注册被婉拒 (AGE_BELOW_FLOOR)', async () => {
    const res = await http(app)
      .post('/v1/auth/register')
      .send({ email: 'kid@e2e.dev', password: 'password123', birthDate: '2020-01-01', penName: '小孩' })
      .expect(403);
    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe('AGE_BELOW_FLOOR');
  });

  it('未成年 (13–17) 注册成功并进入守护模式', async () => {
    const res = await http(app)
      .post('/v1/auth/register')
      .send({ email: 'teen@e2e.dev', password: 'password123', birthDate: '2012-01-01', penName: '少年' })
      .expect(201);
    expect(res.body.data.ageTier).toBe('TEEN');
    expect(res.body.data.guardianMode).toBe(true);
  });

  it('完整跑通 注册 → 写信 → 入海 → 打捞 → 拆封 → 回信 → 结缘', async () => {
    const prisma = app.get(PrismaService, { strict: false });

    // 作者注册 + 写信（审核通过 → DELIVERING）
    const author = await registerAdult(app, { penName: '林深' });
    const compose = await http(app)
      .post('/v1/letters/compose')
      .set('Authorization', `Bearer ${author.token}`)
      .send({ body: CLEAN_LETTER, theme: '雨天' })
      .expect(201);
    expect(compose.body.data.status).toBe('DELIVERING');
    const letterId = compose.body.data.letterId as string;

    // 入海：测试里直接推进到 FLOATING（等价于 scheduler.floatArrivedLetters）
    await prisma.letter.update({
      where: { publicId: letterId },
      data: { status: LetterStatus.FLOATING, poolVisibleAt: new Date(Date.now() - 1000) },
    });

    // 读者注册 + 打捞
    const reader = await registerAdult(app, { penName: '阿禾' });
    const fish = await http(app)
      .post('/v1/ocean/fish')
      .set('Authorization', `Bearer ${reader.token}`)
      .expect(201);
    const fishingId = fish.body.data.fishingId as string;
    expect(fishingId).toBeTruthy();
    expect(fish.body.data.penName).toBe('林深');

    // 拆封 → 读到全文
    const unseal = await http(app)
      .post(`/v1/fishing/${fishingId}/unseal`)
      .set('Authorization', `Bearer ${reader.token}`)
      .expect(201);
    const unsealId = unseal.body.data.unsealId as string;
    expect(unseal.body.data.body).toBe(CLEAN_LETTER);
    expect(unseal.body.data.author.penName).toBe('林深');

    // 回信 → 结缘
    const reply = await http(app)
      .post(`/v1/unseals/${unsealId}/reply`)
      .set('Authorization', `Bearer ${reader.token}`)
      .send({ body: CLEAN_REPLY })
      .expect(201);
    expect(reply.body.data.status).toBe('ACTIVE');
    const relationId = reply.body.data.relationId as string;
    expect(relationId).toBeTruthy();

    // 双方都能看到这段笔友关系
    const readerPenpals = await http(app)
      .get('/v1/penpals')
      .set('Authorization', `Bearer ${reader.token}`)
      .expect(200);
    expect(readerPenpals.body.data.map((r: any) => r.relationId)).toContain(relationId);
    expect(readerPenpals.body.data[0].partner.penName).toBe('林深');

    const authorPenpals = await http(app)
      .get('/v1/penpals')
      .set('Authorization', `Bearer ${author.token}`)
      .expect(200);
    expect(authorPenpals.body.data[0].partner.penName).toBe('阿禾');

    // 信状态已 PAIRED
    const letter = await prisma.letter.findUnique({ where: { publicId: letterId } });
    expect(letter?.status).toBe(LetterStatus.PAIRED);
  });

  it('每日投递配额：同日第二次写信被拦 (QUOTA_EXHAUSTED)', async () => {
    const author = await registerAdult(app);
    await http(app)
      .post('/v1/letters/compose')
      .set('Authorization', `Bearer ${author.token}`)
      .send({ body: CLEAN_LETTER })
      .expect(201);
    const second = await http(app)
      .post('/v1/letters/compose')
      .set('Authorization', `Bearer ${author.token}`)
      .send({ body: CLEAN_LETTER })
      .expect(403);
    expect(second.body.error.code).toBe('QUOTA_EXHAUSTED');
  });
});
