import { Module } from '@nestjs/common';
import { QuotaModule } from '../quota/quota.module';
import { OceanService } from './ocean.service';
import { OceanController } from './ocean.controller';

@Module({
  imports: [QuotaModule],
  providers: [OceanService],
  controllers: [OceanController],
})
export class OceanModule {}
