import { Module } from '@nestjs/common';
import { PenpalsService } from './penpals.service';
import { PenpalsController } from './penpals.controller';

@Module({
  providers: [PenpalsService],
  controllers: [PenpalsController],
})
export class PenpalsModule {}
