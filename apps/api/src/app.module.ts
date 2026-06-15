import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import configuration from './config/configuration';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { QuotaModule } from './modules/quota/quota.module';
import { ModerationModule } from './modules/moderation/moderation.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { LettersModule } from './modules/letters/letters.module';
import { OceanModule } from './modules/ocean/ocean.module';
import { PenpalsModule } from './modules/penpals/penpals.module';
import { ReportsModule } from './modules/reports/reports.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      // 后端读取仓库根目录 .env（兼容 apps/api/.env）
      envFilePath: ['../../.env', '.env'],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    ModerationModule,
    DeliveryModule,
    AuthModule,
    UsersModule,
    QuotaModule,
    LettersModule,
    OceanModule,
    PenpalsModule,
    ReportsModule,
    NotificationsModule,
  ],
  providers: [
    // 全局 JWT 守卫（用 @Public() 放行公开端点）
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
