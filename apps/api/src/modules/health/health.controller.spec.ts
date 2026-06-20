import { describe, it, expect } from 'vitest';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import type { PrismaService } from '../../common/prisma/prisma.service';
import type { RedisService } from '../../common/redis/redis.service';

const okPrisma = { $queryRaw: async () => [{ ok: 1 }] } as unknown as PrismaService;
const okRedis = { client: { ping: async () => 'PONG' } } as unknown as RedisService;

describe('HealthController', () => {
  it('live() 始终 200（不查依赖）', () => {
    const c = new HealthController(okPrisma, okRedis);
    expect(c.live()).toEqual({ status: 'ok' });
  });

  it('ready() DB+Redis 正常 → ready', async () => {
    const c = new HealthController(okPrisma, okRedis);
    await expect(c.ready()).resolves.toEqual({ status: 'ready', checks: { db: true, redis: true } });
  });

  it('ready() DB 故障 → 503', async () => {
    const badPrisma = {
      $queryRaw: async () => {
        throw new Error('db down');
      },
    } as unknown as PrismaService;
    const c = new HealthController(badPrisma, okRedis);
    await expect(c.ready()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('ready() Redis 故障 → 503', async () => {
    const badRedis = {
      client: {
        ping: async () => {
          throw new Error('redis down');
        },
      },
    } as unknown as RedisService;
    const c = new HealthController(okPrisma, badRedis);
    await expect(c.ready()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
