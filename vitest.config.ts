import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

/**
 * 单仓统一测试入口（详见 docs/代码审计与迭代计划.md §4）。
 * - 纯逻辑测试：packages/shared 与 apps/api 的零依赖函数，无需 DB/Redis。
 * - service 回归测试：手动 new Service(mock...)，依赖 @prisma/client 已生成的枚举。
 * 别名把 @inkling/shared 指到源码，免去测试前先 build:shared。
 */
export default defineConfig({
  resolve: {
    alias: {
      '@inkling/shared': resolve(__dirname, 'packages/shared/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['packages/**/src/**/*.spec.ts', 'apps/api/src/**/*.spec.ts'],
  },
});
