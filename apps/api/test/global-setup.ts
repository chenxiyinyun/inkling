import { execSync } from 'node:child_process';

/**
 * 集成测试全局前置（vitest globalSetup，仅执行一次）：
 * 复用 vitest-env.setup 的环境解析（.env 加载 / 测试库自动派生 / 安全闸），
 * 再对测试库应用迁移（幂等），使「docker compose up -d 后直接 pnpm test:integration」开箱可用。
 */
export default async function setup() {
  await import('./vitest-env.setup');
  try {
    execSync('pnpm --filter @inkling/api exec prisma migrate deploy', {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'pipe',
    });
  } catch (e: any) {
    const out = `${e?.stdout?.toString?.() ?? ''}${e?.stderr?.toString?.() ?? ''}`.trim();
    throw new Error(
      '[集成测试] 无法对测试库应用迁移。请确认：① `docker compose up -d`（PG+Redis 已就绪）；' +
        '② 测试库已创建（`docker compose exec -T postgres createdb -U inkling inkling_test`，已存在会提示 already exists，可忽略）。\n' +
        out,
    );
  }
}
