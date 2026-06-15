import { createMockFetch } from '~/mocks';

/**
 * 启用前端「假后端」：开发态默认开启（无需起 API/PG/Redis 即可走通全流程）。
 * 关闭：设环境变量 NUXT_PUBLIC_USE_MOCK=0（接真实后端时）。
 * 强制开启：NUXT_PUBLIC_USE_MOCK=1。
 */
export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();
  const useMock = String(config.public.useMock ?? 'auto');
  const enabled = useMock === '1' || (useMock === 'auto' && import.meta.dev);
  if (!enabled) return;

  const real = (globalThis as any).$fetch;
  if (!real) return;
  (globalThis as any).$fetch = createMockFetch(real);

  if (import.meta.dev) {
    // eslint-disable-next-line no-console
    console.info('%c[inkling] 前端 Mock 后端已启用（无需 API）。账号随便填即可登录；设 NUXT_PUBLIC_USE_MOCK=0 关闭。', 'color:#C2703D;font-weight:600');
  }
});
