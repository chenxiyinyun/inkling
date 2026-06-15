import { Controller, Get } from '@nestjs/common';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

/**
 * 通知（MVP 占位）。
 * 设计：强通知仅用于"笔友回信抵达""回信窗口剩 <24h"；弱通知用应用内角标。
 * 生产期：WebSocket 实时事件 + Web Push / 服务号补充通道（详见 docs/产品设计文档.md §1.8）。
 */
@Controller('notifications')
export class NotificationsController {
  @Get()
  list(@CurrentUser() _user: AuthUser) {
    return [];
  }
}
