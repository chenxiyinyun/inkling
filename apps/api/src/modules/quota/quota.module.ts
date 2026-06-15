import { Module } from '@nestjs/common';
import { QuotaService } from './quota.service';
import { QuotaController } from './quota.controller';

@Module({
  providers: [QuotaService],
  controllers: [QuotaController],
  exports: [QuotaService],
})
export class QuotaModule {}
