import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';

@Controller()
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post('reports')
  report(@CurrentUser() user: AuthUser, @Body() dto: CreateReportDto) {
    return this.reports.createReport(user.userId, dto);
  }

  @Post('blocks')
  block(@CurrentUser() user: AuthUser, @Body('targetPublicId') targetPublicId: string) {
    return this.reports.block(user.userId, targetPublicId);
  }

  @Delete('blocks/:targetPublicId')
  unblock(@CurrentUser() user: AuthUser, @Param('targetPublicId') targetPublicId: string) {
    return this.reports.unblock(user.userId, targetPublicId);
  }

  @Get('blocks')
  listBlocks(@CurrentUser() user: AuthUser) {
    return this.reports.listBlocks(user.userId);
  }

  @Post('appeals')
  appeal(@CurrentUser() user: AuthUser, @Body('detail') detail: string) {
    return this.reports.appeal(user.userId, detail);
  }

  @Get('me/penalties')
  penalties(@CurrentUser() user: AuthUser) {
    return this.reports.myPenalties(user.userId);
  }
}
