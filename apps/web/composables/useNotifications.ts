import type { NotificationItem, NotificationPage } from '@inkling/shared';

// 模块级单例轮询器：整个应用只跑一个 interval（AppHeader 常驻，启动一次）。
let pollTimer: ReturnType<typeof setInterval> | null = null;

/**
 * 通知中心数据源（弱信号）。useState 单例让 AppHeader 角标与通知页共享同一份响应式数据，
 * 不重复拉取；轮询 45s 一次，契合"慢社交"节奏。失败静默（通知失败不打扰用户）。
 */
export function useNotifications() {
  const api = useApi();
  const items = useState<NotificationItem[]>('inkling_notifications', () => []);
  const unread = useState<number>('inkling_notifications_unread', () => 0);

  async function refresh() {
    try {
      const page = await api.get<NotificationPage>('/notifications');
      items.value = page?.items ?? [];
      const c = await api.get<{ unread: number }>('/notifications/unread-count');
      unread.value = c?.unread ?? 0;
    } catch {
      /* 弱信号：拉取失败保持原值，不打扰 */
    }
  }

  /** 标记已读：传 ids 标记指定，省略则全部。乐观更新本地。 */
  async function markRead(ids?: string[]) {
    try {
      await api.post('/notifications/read', ids && ids.length ? { ids } : { all: true });
      items.value = items.value.map((n) => (!ids || ids.includes(n.publicId) ? { ...n, read: true } : n));
      unread.value = items.value.filter((n) => !n.read).length;
    } catch {
      /* ignore */
    }
  }

  function startPolling(intervalMs = 45_000) {
    if (!import.meta.client || pollTimer) return;
    void refresh();
    pollTimer = setInterval(() => void refresh(), intervalMs);
  }

  return { items, unread, refresh, markRead, startPolling };
}
