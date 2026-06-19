import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { uniqueSuffix } from './factory';

/** 干净、>50 字、无联系方式/敏感词的正文，能通过审核与最小长度校验。 */
export const CLEAN_LETTER =
  '你好呀，很高兴在这片漂流海里遇见你的信。我平日喜欢在窗边读书、煮茶，也爱在傍晚散步看云，想和你聊聊那些细碎而温柔的日常时光。';
export const CLEAN_REPLY =
  '读到你的信很开心。我也常在雨天泡一壶茶，听窗外淅沥的声音，慢慢写点东西。很想知道你最近在忙些什么，又被什么样的风景打动过呢。';

export function http(app: INestApplication) {
  return request(app.getHttpServer());
}

/** 注册一个成年用户，返回 token / publicId / email。 */
export async function registerAdult(
  app: INestApplication,
  over: { penName?: string; birthDate?: string } = {},
): Promise<{ token: string; publicId: string; email: string }> {
  const n = uniqueSuffix();
  const email = `e2e-${n}@e2e.dev`;
  const res = await http(app)
    .post('/v1/auth/register')
    .send({
      email,
      password: 'password123',
      birthDate: over.birthDate ?? '1990-01-01',
      penName: over.penName ?? `Tester${n}`,
    })
    .expect(201);
  return { token: res.body.data.accessToken, publicId: res.body.data.publicId, email };
}
