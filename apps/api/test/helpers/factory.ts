import type { INestApplication } from '@nestjs/common';
import { LetterStatus } from '@prisma/client';
import { PrismaService } from '../../src/common/prisma/prisma.service';

let seq = 0;
/** 进程内自增，保证 email 等唯一字段不撞（即便 TRUNCATE 后计数仍递增）。 */
export function uniqueSuffix(): string {
  return `${(seq += 1)}`;
}

/** 直接建一个带 profile 的成年用户（绕过 HTTP，集成测试更快）。 */
export async function createUser(
  app: INestApplication,
  opts: { penName?: string; mbti?: string; invisible?: boolean; geohash5?: string | null } = {},
) {
  const prisma = app.get(PrismaService, { strict: false });
  const n = uniqueSuffix();
  return prisma.user.create({
    data: {
      passwordHash: 'x',
      ageTier: 'ADULT',
      email: `factory-${n}@e2e.dev`,
      profile: {
        create: {
          penName: opts.penName ?? `User${n}`,
          mbti: opts.mbti ?? 'UNKNOWN',
          invisible: opts.invisible ?? false,
          geohash5: opts.geohash5 ?? null,
        },
      },
    },
    include: { profile: true },
  });
}

/** 建一封指定状态的信。默认 FLOATING + 立即可被打捞、30 天后过期。 */
export async function createLetter(
  app: INestApplication,
  authorId: string,
  opts: {
    status?: LetterStatus;
    body?: string;
    poolVisibleAt?: Date | null;
    expireAt?: Date | null;
    recycleCount?: number;
    withSnapshot?: boolean;
  } = {},
) {
  const prisma = app.get(PrismaService, { strict: false });
  const body =
    opts.body ?? '这是一封用于集成测试的漂流信，内容干净友好，足够长以通过最小长度校验，愿在海上遇见有缘人来读它。';
  return prisma.letter.create({
    data: {
      authorId,
      body,
      status: opts.status ?? LetterStatus.FLOATING,
      poolVisibleAt: opts.poolVisibleAt === undefined ? new Date(Date.now() - 1000) : opts.poolVisibleAt,
      expireAt: opts.expireAt === undefined ? new Date(Date.now() + 30 * 86400000) : opts.expireAt,
      recycleCount: opts.recycleCount ?? 0,
      ...(opts.withSnapshot
        ? { previewSnapshot: { create: { partialTags: [], bodyExcerpt: body.slice(0, 40) } } }
        : {}),
    },
  });
}

/** 预建当日配额行（默认上限），避免 ensureToday 在并发首扣时的 upsert 插入竞态。 */
export async function ensureQuotaRow(
  app: INestApplication,
  userId: string,
  caps: { send?: number; fish?: number; unseal?: number } = {},
) {
  const prisma = app.get(PrismaService, { strict: false });
  const date = new Date().toISOString().slice(0, 10); // UTC 自然日，与 QuotaService.today() 一致
  return prisma.dailyQuota.create({
    data: {
      userId,
      date,
      sendLeft: caps.send ?? 1,
      fishLeft: caps.fish ?? 3,
      unsealLeft: caps.unseal ?? 1,
    },
  });
}
