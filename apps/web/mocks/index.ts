/**
 * 假后端调度器：把 useApi 的 $fetch 调用按 /v1 路由表分发到内存 handler，
 * 非 /v1 请求原样交回真实 $fetch（Nuxt 内部、静态资源等不受影响）。
 */
import { matchRoute, MockError } from './handlers';

const API_PREFIX = '/v1';

/** 从完整 URL 取 /v1 之后的接口路径；非 /v1 返回 null。 */
function apiPathOf(url: string): string | null {
  let pathname: string;
  try {
    pathname = url.startsWith('http') ? new URL(url).pathname : url.split('?')[0];
  } catch {
    pathname = url.split('?')[0];
  }
  const idx = pathname.indexOf(API_PREFIX);
  if (idx === -1) return null;
  const rest = pathname.slice(idx + API_PREFIX.length);
  if (rest === '' || rest === '/') return '/';
  return rest.startsWith('/') ? rest : null;
}

function normalizeBody(body: unknown): any {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }
  return body;
}

/** 构造 ofetch 风格错误，使 useApi 的 catch（读 e.response.status / e.data.error）正常工作。 */
function fetchError(status: number, code: string, message: string): Error {
  const err = new Error(message) as any;
  err.status = status;
  err.statusCode = status;
  err.response = { status, _data: { ok: false, error: { code, message } } };
  err.data = { ok: false, error: { code, message } };
  return err;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function createMockFetch(realFetch: any) {
  const mockFetch: any = async (request: any, opts: any = {}) => {
    const url = typeof request === 'string' ? request : request?.url ?? String(request);
    const path = apiPathOf(url);
    if (path == null) return realFetch(request, opts); // 非 /v1，放行

    const method = String(opts.method ?? 'GET').toUpperCase();
    const matched = matchRoute(method, path);
    if (!matched) throw fetchError(404, 'NOT_MOCKED', `mock 未实现：${method} ${path}`);

    await delay(180); // 一点网络感
    try {
      const data = matched.route.run({ params: matched.params, body: normalizeBody(opts.body) });
      return { ok: true, data };
    } catch (e) {
      if (e instanceof MockError) throw fetchError(e.status, e.code, e.message);
      throw e;
    }
  };

  // 保留 $fetch 的附属方法（raw/create/native 等），避免 Nuxt 内部调用缺失
  Object.assign(mockFetch, realFetch);
  return mockFetch;
}

export { resetDb } from './db';
