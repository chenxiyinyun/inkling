import type { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { RedisService } from '../../src/common/redis/redis.service';

// 全部业务表（@@map 后的实际表名）。子 → 父排序；TRUNCATE ... CASCADE 其实不依赖顺序，
// 列全只为可读 + 万一改用 deleteMany 时备用。
const TABLES = [
  'data_deletion_requests',
  'blocks',
  'reports',
  'penalties',
  'content_reviews',
  'daily_quotas',
  'delivery_tasks',
  'correspondences',
  'pen_pal_relations',
  'unseal_records',
  'fishing_records',
  'preview_snapshots',
  'letters',
  'parental_consents',
  'user_profiles',
  'users',
];

/** 清空所有业务表 + Redis，保证每个用例从干净状态开始。 */
export async function resetDb(app: INestApplication): Promise<void> {
  const prisma = app.get(PrismaService, { strict: false });
  const list = TABLES.map((t) => `"${t}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE;`);

  const redis = app.get(RedisService, { strict: false });
  await redis.client.flushdb();
}
