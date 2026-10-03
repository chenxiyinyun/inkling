import { useAuthStore } from '~/stores/auth';

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

/** 刷新单飞：并发 401 只触发一次刷新，其余请求等待同一个 Promise。 */
let refreshPromise: Promise<string> | null = null;

/** 统一 API 客户端：注入 Bearer token、解包 { ok, data }、401 自动刷新并重放、抛出可读错误。 */
export function useApi() {
  const config = useRuntimeConfig();
  const auth = useAuthStore();
  const base = config.public.apiBase as string;

  async function doFetch<T>(method: Method, path: string, body?: unknown) {
    return $fetch<{ ok: boolean; data?: T; error?: { code: string; message: string } }>(base + path, {
      method,
      body: body as any,
      headers: auth.token ? { Authorization: `Bearer ${auth.token}` } : {},
    });
  }

  /** 用 refresh token 换新令牌（单飞去重）。成功后写回 store 并返回新 access token。 */
  async function refreshTokens(): Promise<string> {
    if (!refreshPromise) {
      refreshPromise = (async () => {
        const res = await $fetch<{ ok: boolean; data?: { accessToken: string; refreshToken?: string } }>(
          base + '/auth/token/refresh',
          { method: 'POST', body: { refreshToken: auth.refreshToken } },
        );
        const data = res.data;
        if (!data?.accessToken) throw new Error('refresh failed');
        auth.setTokens(data.accessToken, data.refreshToken);
        return data.accessToken;
      })().finally(() => {
        refreshPromise = null;
      });
    }
    return refreshPromise;
  }

  function logoutAndGoLogin() {
    auth.logout();
    if (import.meta.client) navigateTo('/login');
  }

  async function request<T = any>(method: Method, path: string, body?: unknown, retried = false): Promise<T> {
    try {
      const res = await doFetch<T>(method, path, body);
      return res.data as T;
    } catch (e: any) {
      const status = e?.response?.status;
      // 401：先尝试用 refresh token 换新令牌并重放一次
      // （access token 默认仅 15 分钟；/auth/* 自身 401 不重试，防死循环）
      if (status === 401 && !retried && !path.startsWith('/auth/') && auth.refreshToken) {
        try {
          await refreshTokens();
          return await request<T>(method, path, body, true);
        } catch (re: any) {
          logoutAndGoLogin();
          throw new Error(re?.data?.error?.message || '登录已过期，请重新登录');
        }
      }
      if (status === 401) logoutAndGoLogin();
      const message = e?.data?.error?.message || e?.message || '邮局暂时联系不上，稍后再试';
      throw new Error(message);
    }
  }

  return {
    get: <T = any>(p: string) => request<T>('GET', p),
    post: <T = any>(p: string, b?: unknown) => request<T>('POST', p, b),
    patch: <T = any>(p: string, b?: unknown) => request<T>('PATCH', p, b),
    del: <T = any>(p: string) => request<T>('DELETE', p),
  };
}
