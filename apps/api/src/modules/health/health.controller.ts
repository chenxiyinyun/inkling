import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

/**
 * 健康探针：供反向代理 / 容器编排 / 上线后探活使用。公开（无需鉴权）。
 * - GET /v1/health        存活：进程在跑即 200，不查依赖（用于心跳/重启判定）。
 * - GET /v1/health/ready  就绪：DB + Redis 均可用才 200；任一不可用 → 503（不放流量）。
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @Get()
  live() {
    return { status: 'ok' };
  }

  @Public()
  @Get('ready')
  async ready() {
    const checks = { db: false, redis: false };
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.db = true;
    } catch {
      checks.db = false;
    }
    try {
      checks.redis = (await this.redis.client.ping()) === 'PONG';
    } catch {
      checks.redis = false;
    }
    if (!checks.db || !checks.redis) {
      throw new ServiceUnavailableException({ status: 'unready', checks });
    }
    return { status: 'ready', checks };
  }
}
