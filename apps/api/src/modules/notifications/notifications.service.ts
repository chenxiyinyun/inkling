import { Injectable } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { timeBand, NotificationType as SharedNotificationType, type NotificationItem, type NotificationPage } from '@inkling/shared';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * 系统通知（弱通知，去人格化）。MVP 用前端轮询消费；生产期叠加 WebSocket/Web Push。
 * ref 只存公开 id，绝不含对方身份（致命级约束，见 docs/API设计.md §4.3）。
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** 写入一条通知（best-effort，调用方通常已确保只在真实状态流转时触发，故幂等由调用方保证）。 */
  async create(
    userId: string,
    type: NotificationType,
    title: string,
    ref: Record<string, unknown> = {},
  ): Promise<void> {
    await this.prisma.notification.create({
      data: { userId, type, title, ref: ref as Prisma.InputJsonValue },
    });
  }

  /** 游标分页列出（按时间倒序）。cursor 为上一页末条 publicId。 */
  async list(userId: string, cursor?: string, limit = 20): Promise<NotificationPage> {
    const take = Math.min(Math.max(Math.trunc(limit) || 20, 1), 50);
    const rows = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(cursor ? { cursor: { publicId: cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;
    const now = new Date();
    const items: NotificationItem[] = page.map((n) => ({
      publicId: n.publicId,
      // Prisma 与 shared 的 NotificationType 值集合一致（enum-drift 守护），仅 TS 名义类型不同，故此处归一
      type: n.type as unknown as SharedNotificationType,
      title: n.title,
      ref: (n.ref as Record<string, unknown>) ?? {},
      createdAt: n.createdAt.toISOString(),
      createdBand: timeBand(n.createdAt, now),
      read: n.read,
    }));
    return { items, nextCursor: hasMore ? page[page.length - 1].publicId : null, hasMore, limit: take };
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, read: false } });
  }

  /** 标记已读：按公开 id 列表或全部。 */
  async markRead(userId: string, ids?: string[], all?: boolean): Promise<{ updated: number }> {
    if (all) {
      const r = await this.prisma.notification.updateMany({
        where: { userId, read: false },
        data: { read: true },
      });
      return { updated: r.count };
    }
    if (ids && ids.length) {
      const r = await this.prisma.notification.updateMany({
        where: { userId, publicId: { in: ids }, read: false },
        data: { read: true },
      });
      return { updated: r.count };
    }
    return { updated: 0 };
  }
}
