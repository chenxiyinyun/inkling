import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Redis 封装：用于分布式锁（拆封竞态）与高频计数。
 * 配额最终一致性以 DB 为权威（详见 QuotaService），此处提供锁原语。
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;

  constructor() {
    this.client = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: 2,
      lazyConnect: false,
    });
  }

  /** 尝试加锁，成功返回 token，失败返回 null。 */
  async acquireLock(key: string, ttlSeconds: number): Promise<string | null> {
    const token = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ok = await this.client.set(key, token, 'EX', ttlSeconds, 'NX');
    return ok ? token : null;
  }

  /** 释放锁（仅当 token 匹配，避免误删他人锁）。 */
  async releaseLock(key: string, token: string): Promise<void> {
    const lua = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end`;
    await this.client.eval(lua, 1, key, token);
  }

  async onModuleDestroy() {
    await this.client.quit().catch(() => undefined);
  }
}
