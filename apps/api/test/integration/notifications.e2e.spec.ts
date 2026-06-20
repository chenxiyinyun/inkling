import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { LetterStatus, NotificationType } from '@prisma/client';
import { createTestApp } from '../helpers/app';
import { resetDb } from '../helpers/db';
import { createLetter, createUser } from '../helpers/factory';
import { http, registerAdult } from '../helpers/http';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { DeliveryScheduler } from '../../src/modules/delivery/delivery.scheduler';

const PAST = () => new Date(Date.now() - 60_000);

/** 通知埋点（真实 PG）：scheduler 流转 + ocean 打捞触发去人格化弱通知；HTTP 列表/已读。 */
describe('通知 e2e（真实 PG）', () => {
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

  it('在途到点 → 通知作者 LETTER_DELIVERED（ref 含 letterPublicId）', async () => {
    const author = await createUser(app, {});
    const letter = await createLetter(app, author.id, { status: LetterStatus.DELIVERING, poolVisibleAt: PAST() });
    await scheduler.tick();
    const notes = await prisma.notification.findMany({ where: { userId: author.id, type: NotificationType.LETTER_DELIVERED } });
    expect(notes.length).toBe(1);
    expect((notes[0].ref as any).letterPublicId).toBe(letter.publicId);
  });

  it('笔友回信送达 → 通知收信方（非发送者）PENPAL_REPLY_ARRIVED', async () => {
    const author = await createUser(app, {});
    const reader = await createUser(app, {});
    const letter = await createLetter(app, author.id, { status: LetterStatus.PAIRED });
    const rel = await prisma.penPalRelation.create({
      data: { userAId: author.id, userBId: reader.id, sourceLetterId: letter.id, exchangeCount: 1 },
    });
    await prisma.correspondence.create({
      data: { relationId: rel.id, senderId: reader.id, body: '在途的回信正文，足够长以便生成预览片段。', deliverAt: PAST(), deliveredAt: null },
    });
    await scheduler.tick();
    // senderId=reader → 收信方=author
    const notes = await prisma.notification.findMany({ where: { userId: author.id, type: NotificationType.PENPAL_REPLY_ARRIVED } });
    expect(notes.length).toBe(1);
    expect((notes[0].ref as any).relationPublicId).toBe(rel.publicId);
    // 发送者自己不应收到
    const senderNotes = await prisma.notification.count({ where: { userId: reader.id, type: NotificationType.PENPAL_REPLY_ARRIVED } });
    expect(senderNotes).toBe(0);
  });

  it('拆封超窗回池 → 通知拆封者 UNSEAL_EXPIRED_REDRIFT', async () => {
    const author = await createUser(app, {});
    const reader = await createUser(app, {});
    const letter = await createLetter(app, author.id, { status: LetterStatus.SEALED_OPEN, recycleCount: 0 });
    await prisma.unsealRecord.create({ data: { userId: reader.id, letterId: letter.id, replyDeadline: PAST(), replied: false } });
    await scheduler.tick();
    const notes = await prisma.notification.findMany({ where: { userId: reader.id, type: NotificationType.UNSEAL_EXPIRED_REDRIFT } });
    expect(notes.length).toBe(1);
  });

  it('回信窗口剩 ≤24h → 预警一次；warnedAt 去重，二次 tick 不重复', async () => {
    const author = await createUser(app, {});
    const reader = await createUser(app, {});
    const letter = await createLetter(app, author.id, { status: LetterStatus.SEALED_OPEN });
    const soon = new Date(Date.now() + 12 * 3_600_000); // 窗口内、尚未到期
    const ur = await prisma.unsealRecord.create({ data: { userId: reader.id, letterId: letter.id, replyDeadline: soon, replied: false } });

    await scheduler.tick();
    let notes = await prisma.notification.findMany({ where: { userId: reader.id, type: NotificationType.UNSEAL_REPLY_WINDOW_WARNING } });
    expect(notes.length).toBe(1);
    expect((await prisma.unsealRecord.findUnique({ where: { id: ur.id } }))?.warnedAt).not.toBeNull();

    await scheduler.tick();
    notes = await prisma.notification.findMany({ where: { userId: reader.id, type: NotificationType.UNSEAL_REPLY_WINDOW_WARNING } });
    expect(notes.length).toBe(1); // 不重复
  });

  it('打捞 → 通知作者 LETTER_FISHED（去人格化，不含打捞者）', async () => {
    const author = await createUser(app, {});
    const letter = await createLetter(app, author.id, { withSnapshot: true });
    const reader = await registerAdult(app);
    await http(app).post('/v1/ocean/fish').set('Authorization', `Bearer ${reader.token}`).expect(201);
    const notes = await prisma.notification.findMany({ where: { userId: author.id, type: NotificationType.LETTER_FISHED } });
    expect(notes.length).toBe(1);
    expect((notes[0].ref as any).letterPublicId).toBe(letter.publicId);
    // ref 绝不含打捞者身份
    expect(JSON.stringify(notes[0].ref)).not.toContain(reader.publicId);
  });

  it('HTTP：列表 / 未读数 / 标记全部已读', async () => {
    const u = await registerAdult(app);
    const dbUser = await prisma.user.findUnique({ where: { publicId: u.publicId } });
    await prisma.notification.createMany({
      data: [
        { userId: dbUser!.id, type: NotificationType.LETTER_DELIVERED, title: '你的信已漂入海面' },
        { userId: dbUser!.id, type: NotificationType.LETTER_FISHED, title: '有人拾起了你的信' },
      ],
    });

    const list = await http(app).get('/v1/notifications').set('Authorization', `Bearer ${u.token}`).expect(200);
    expect(list.body.data.items.length).toBe(2);
    expect(list.body.data.items[0].createdBand).toBeTruthy();

    const unread = await http(app).get('/v1/notifications/unread-count').set('Authorization', `Bearer ${u.token}`).expect(200);
    expect(unread.body.data.unread).toBe(2);

    await http(app).post('/v1/notifications/read').set('Authorization', `Bearer ${u.token}`).send({ all: true }).expect(201);
    const unread2 = await http(app).get('/v1/notifications/unread-count').set('Authorization', `Bearer ${u.token}`).expect(200);
    expect(unread2.body.data.unread).toBe(0);
  });
});
