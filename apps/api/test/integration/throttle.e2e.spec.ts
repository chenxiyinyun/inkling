import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { createTestApp } from '../helpers/app';
import { http } from '../helpers/http';

/**
 * 验证「限流确实生效」。与其它 e2e 不同：这里**临时开启**限流并把全局上限调到 3，
 * 便于快速触发 429；afterAll 复原集成测试默认（关限流），避免影响其它文件。
 * （整套 e2e fileParallelism=false 串行执行，process.env 改动不会与其它文件交叠。）
 */
describe('限流 e2e（真实 HTTP 管线）', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.THROTTLE_DISABLED = '0'; // 开启限流
    process.env.THROTTLE_LIMIT = '3'; // 全局每 IP×路由 3/窗口
    app = await createTestApp();
  });
  afterAll(async () => {
    await app?.close();
    process.env.THROTTLE_DISABLED = '1'; // 恢复集成测试默认：关限流
    delete process.env.THROTTLE_LIMIT; // 恢复默认上限
  });

  it('超过全局上限 → 429（公开 /health，限 3/窗口）', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) {
      const res = await http(app).get('/v1/health');
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 3)).toEqual([200, 200, 200]);
    expect(statuses[3]).toBe(429);
  });

  it('auth 端点单独设更严上限(8>全局3)：连发 4 次登录均不被限流（非 429）', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) {
      const res = await http(app)
        .post('/v1/auth/login')
        .send({ email: 'nope-throttle@e2e.dev', password: 'wrongpass123' });
      statuses.push(res.status);
    }
    // 4 次均未触发 429 → 证明 @Throttle 把该路由上限从全局 3 抬到 8
    expect(statuses.every((s) => s !== 429)).toBe(true);
  });
});
