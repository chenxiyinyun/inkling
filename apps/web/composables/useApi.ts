import { useAuthStore } from '~/stores/auth';

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

/** 统一 API 客户端：注入 Bearer token、解包 { ok, data }、抛出可读错误。 */
export function useApi() {
  const config = useRuntimeConfig();
  const auth = useAuthStore();
  const base = config.public.apiBase as string;

  async function request<T = any>(method: Method, path: string, body?: unknown): Promise<T> {
    try {
      const res = await $fetch<{ ok: boolean; data?: T; error?: { code: string; message: string } }>(base + path, {
        method,
        body: body as any,
        headers: auth.token ? { Authorization: `Bearer ${auth.token}` } : {},
      });
      return res.data as T;
    } catch (e: any) {
      if (e?.response?.status === 401) {
        auth.logout();
        if (import.meta.client) navigateTo('/login');
      }
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
