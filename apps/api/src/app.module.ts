import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import configuration from './config/configuration';
import type { AppConfig } from './config/configuration';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { QuotaModule } from './modules/quota/quota.module';
import { ModerationModule } from './modules/moderation/moderation.module';
import { PenaltyModule } from './modules/penalty/penalty.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { LettersModule } from './modules/letters/letters.module';
import { OceanModule } from './modules/ocean/ocean.module';
import { PenpalsModule } from './modules/penpals/penpals.module';
import { ReportsModule } from './modules/reports/reports.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      // 后端读取仓库根目录 .env（兼容 apps/api/.env）
      envFilePath: ['../../.env', '.env'],
    }),
    ScheduleModule.forRoot(),
    // 限流：窗口内每 IP 每路由 limit 次；测试环境（disabled）整体跳过。
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const t = config.get<AppConfig['throttle']>('throttle')!;
        return { throttlers: [{ ttl: t.ttlMs, limit: t.limit }], skipIf: () => t.disabled };
      },
    }),
    PrismaModule,
    RedisModule,
    ModerationModule,
    PenaltyModule,
    DeliveryModule,
    AuthModule,
    UsersModule,
    QuotaModule,
    LettersModule,
    OceanModule,
    PenpalsModule,
    ReportsModule,
    NotificationsModule,
    HealthModule,
  ],
  providers: [
    // 全局限流守卫（先于鉴权，挡高频暴力；@Public 端点同样受限）
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // 全局 JWT 守卫（用 @Public() 放行公开端点）
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
