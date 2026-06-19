import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import swc from 'unplugin-swc';

/**
 * 集成 / e2e 测试入口（B 档：需本机或 CI 的 PostgreSQL + Redis）。
 * 与零基建的 vitest.config.ts 分离，普通 `pnpm test` 不会碰 DB。
 *
 * 关键：用 unplugin-swc 转译而非 Vitest 默认的 esbuild ——
 * esbuild 不输出装饰器元数据（emitDecoratorMetadata），会导致 NestJS DI
 * 在 Test 模块里解析 `app.get(XxxService)` 失败。swc 开启 decoratorMetadata 后即可。
 *
 * 串行执行：所有用例共享同一套 PG/Redis，靠每个用例前 TRUNCATE + flushdb 隔离。
 */
export default defineConfig({
  resolve: {
    alias: {
      '@inkling/shared': resolve(__dirname, 'packages/shared/src/index.ts'),
    },
  },
  // `as any`：树里同时存在 vite 5（vitest 用）与 vite 7（unplugin-swc 类型）两份，
  // 插件类型对不上但运行期无碍（vitest 以 esbuild 加载本配置）。
  plugins: [
    swc.vite({
      jsc: {
        target: 'es2021',
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }) as any,
  ],
  test: {
    environment: 'node',
    include: ['apps/api/test/**/*.e2e.spec.ts'],
    setupFiles: ['apps/api/test/vitest-env.setup.ts'],
    // 共享单一 DB/Redis：禁用文件级并行，用例间串行 + 每例重置来隔离
    fileParallelism: false,
    sequence: { concurrent: false },
    hookTimeout: 60000,
    testTimeout: 30000,
  },
});
