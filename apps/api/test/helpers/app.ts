import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SchedulerRegistry } from '@nestjs/schedule';
import { configureApp } from '../../src/app.setup';
import { AppModule } from '../../src/app.module';

/**
 * 启动一个与真机管线一致的测试用 Nest 应用（不监听端口）。
 * 默认停掉声明式 @Cron：时间驱动改为测试内手动 `scheduler.tick()` 调用，
 * 避免后台 20s tick 在用例执行中途打乱状态。
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  stopAllCrons(app);
  return app;
}

function stopAllCrons(app: INestApplication): void {
  try {
    const registry = app.get(SchedulerRegistry, { strict: false });
    registry.getCronJobs().forEach((job) => {
      try {
        job.stop();
      } catch {
        /* 单个 job 停止失败忽略 */
      }
    });
  } catch {
    /* SchedulerRegistry 不可用时忽略 */
  }
}
