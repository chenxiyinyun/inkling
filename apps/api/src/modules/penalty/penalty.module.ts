import { Global, Module } from '@nestjs/common';
import { PenaltyService } from './penalty.service';

@Global()
@Module({
  providers: [PenaltyService],
  exports: [PenaltyService],
})
export class PenaltyModule {}
