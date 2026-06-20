import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

// PrismaModule / RedisModule 均为 @Global，无需在此 import。
@Module({ controllers: [HealthController] })
export class HealthModule {}
