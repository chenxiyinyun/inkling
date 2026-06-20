import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { MarkReadDto } from './dto/mark-read.dto';

/**
 * 通知中心（MVP 前端轮询）。
 * 弱通知去人格化（"有人拾起了你的一封信"，不透露是谁）；生产期叠加 WebSocket/Web Push。
 */
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('cursor') cursor?: string, @Query('limit') limit?: string) {
    return this.notifications.list(user.userId, cursor, limit ? Number(limit) : undefined);
  }

  @Get('unread-count')
  async unread(@CurrentUser() user: AuthUser) {
    return { unread: await this.notifications.unreadCount(user.userId) };
  }

  @Post('read')
  markRead(@CurrentUser() user: AuthUser, @Body() dto: MarkReadDto) {
    return this.notifications.markRead(user.userId, dto.ids, dto.all);
  }
}
