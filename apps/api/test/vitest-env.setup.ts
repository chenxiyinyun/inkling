import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

// 本地：加载根目录 .env（若存在）。CI：变量由 job env 注入，已在 process.env 中；
// dotenv 默认不覆盖已存在的 process.env，故 CI 值优先。
loadEnv({ path: resolve(process.cwd(), '.env') });

// 测试环境固定为 test：即使开发机全局设有 NODE_ENV=production，也避免生产语义
// （如配置层强密钥校验）误伤测试环境。
process.env.NODE_ENV = 'test';

// 合理的测试缺省值（仅在未设置时）：装好 Docker 后零配置即可跑集成测试。
process.env.DATABASE_URL ??= 'postgresql://inkling:inkling@localhost:5432/inkling_test?schema=public';
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.JWT_SECRET ??= 'test-secret-please-change';
process.env.LETTER_POOL_DELAY_SECONDS ??= '0';
process.env.DELIVERY_HOURS_SCALE ??= '0'; // 笔友往来在途即时（baseHours × 0），测试不等待
process.env.THROTTLE_DISABLED ??= '1'; // 集成测试从单一 localhost IP 高频打接口，默认关限流免误伤
// （throttle.e2e.spec.ts 会在自身 beforeAll 临时置 '0' 开启限流以验证机制，afterAll 复原）

// 本地 .env 通常指向开发库（inkling）。集成测试一律作用于独立测试库：
// 若 DATABASE_URL 指向非测试库，自动派生为「同名 _test」库（下方安全闸仍会复核）。
{
  const u = new URL(process.env.DATABASE_URL!);
  const name = u.pathname.replace(/^\//, '');
  if (!/test/i.test(name)) {
    u.pathname = `/${name}_test`;
    process.env.DATABASE_URL = u.toString();
    console.log(`[集成测试] DATABASE_URL 指向非测试库，已自动改用 ${name}_test（需确保该库已创建）`);
  }
}

// 安全闸：集成测试会 TRUNCATE 所有表，绝不能误连到开发/生产库。
// 必须精确解析出「库名」再校验（含 "test"）——直接对整条 URL 做子串匹配会被
// 主机名 / 密码 / 连接参数中的 "test"（如 db.testing.internal、application_name=integrationtest）绕过。
const testDbName = (() => {
  try {
    return new URL(process.env.DATABASE_URL!).pathname.replace(/^\//, '');
  } catch {
    return '';
  }
})();
if (!/test/i.test(testDbName)) {
  throw new Error(
    `[集成测试安全闸] DATABASE_URL 的库名必须含 "test"（当前库名：${testDbName || '无法解析'}），以免误清空数据。`,
  );
}
