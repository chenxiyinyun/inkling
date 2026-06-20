import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

// 本地：加载根目录 .env（若存在）。CI：变量由 job env 注入，已在 process.env 中；
// dotenv 默认不覆盖已存在的 process.env，故 CI 值优先。
loadEnv({ path: resolve(process.cwd(), '.env') });

// 合理的测试缺省值（仅在未设置时）：装好 Docker 后零配置即可跑集成测试。
process.env.DATABASE_URL ??= 'postgresql://inkling:inkling@localhost:5432/inkling_test?schema=public';
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.JWT_SECRET ??= 'test-secret-please-change';
process.env.LETTER_POOL_DELAY_SECONDS ??= '0';
process.env.DELIVERY_HOURS_SCALE ??= '0'; // 笔友往来在途即时（baseHours × 0），测试不等待
process.env.THROTTLE_DISABLED ??= '1'; // 集成测试从单一 localhost IP 高频打接口，默认关限流免误伤
// （throttle.e2e.spec.ts 会在自身 beforeAll 临时置 '0' 开启限流以验证机制，afterAll 复原）

// 安全闸：集成测试会 TRUNCATE 所有表，绝不能误连到开发/生产库。
// 要求库名包含 "test"（默认 inkling_test 已满足）。
if (!/test/i.test(process.env.DATABASE_URL)) {
  throw new Error(
    `[集成测试安全闸] DATABASE_URL 必须指向测试库（库名需含 "test"），以免误清空数据。当前为：${process.env.DATABASE_URL}`,
  );
}
