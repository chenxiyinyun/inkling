import type { NotificationItem, NotificationPage } from '@inkling/shared';
import { useAuthStore } from '~/stores/auth';

// 模块级单例轮询器：整个应用只跑一个 interval（AppHeader 常驻，登录后启动）。
let pollTimer: ReturnType<typeof setInterval> | null = null;
let watchInstalled = false;
let refreshing = false;

/**
 * 通知中心数据源（弱信号）。useState 单例让 AppHeader 角标与通知页共享同一份响应式数据，
 * 不重复拉取；轮询 45s 一次，契合"慢社交"节奏。失败静默（通知失败不打扰用户）。
 * 登出即停止轮询并清空：否则登出后仍带空 token 请求 → 反复 401 跳登录。
 */
export function useNotifications() {
  const api = useApi();
  const auth = useAuthStore();
  const toast = useToast();
  const items = useState<NotificationItem[]>('inkling_notifications', () => []);
  const unread = useState<number>('inkling_notifications_unread', () => 0);

  async function refresh() {
    // 防重入：上一次拉取未返回（网络挂起等）时不叠加请求，避免连接被占满后应用整体静默假死
    if (refreshing) return;
    refreshing = true;
    try {
      const page = await api.get<NotificationPage>('/notifications');
      items.value = page?.items ?? [];
      const c = await api.get<{ unread: number }>('/notifications/unread-count');
      unread.value = c?.unread ?? 0;
    } catch {
      /* 弱信号：拉取失败保持原值，不打扰 */
    } finally {
      refreshing = false;
    }
  }

  /** 标记已读：传 ids 标记指定，省略则全部。乐观更新本地。 */
  async function markRead(ids?: string[]) {
    try {
      await api.post('/notifications/read', ids && ids.length ? { ids } : { all: true });
      items.value = items.value.map((n) => (!ids || ids.includes(n.publicId) ? { ...n, read: true } : n));
      unread.value = items.value.filter((n) => !n.read).length;
    } catch (e: any) {
      // 用户主动操作失败不能静默：给出可见反馈，避免"点了没反应"的无助感
      toast.error(e?.message || '标记失败，请稍后再试');
    }
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function reset() {
    stopPolling();
    items.value = [];
    unread.value = 0;
  }

  function startPolling(intervalMs = 45_000) {
    if (!import.meta.client) return;
    if (!watchInstalled) {
      watchInstalled = true;
      watch(
        () => auth.isAuthed,
        (authed) => {
          if (!authed) reset();
        },
      );
    }
    if (pollTimer) return;
    void refresh();
    pollTimer = setInterval(() => void refresh(), intervalMs);
  }

  return { items, unread, refresh, markRead, startPolling, stopPolling, reset };
}
