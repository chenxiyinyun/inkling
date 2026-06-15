import { Controller, Get } from '@nestjs/common';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { QuotaService } from './quota.service';

@Controller('quota')
export class QuotaController {
  constructor(private readonly quota: QuotaService) {}

  @Get('today')
  today(@CurrentUser() user: AuthUser) {
    return this.quota.getToday(user.userId);
  }
}
