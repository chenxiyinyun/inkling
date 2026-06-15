import { Module } from '@nestjs/common';
import { QuotaModule } from '../quota/quota.module';
import { LettersService } from './letters.service';
import { LettersController } from './letters.controller';

@Module({
  imports: [QuotaModule],
  providers: [LettersService],
  controllers: [LettersController],
  exports: [LettersService],
})
export class LettersModule {}
