import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

/**
 * 复用的全局管线装配（详见 docs/代码审计与迭代计划.md §4）。
 * main.ts 与 e2e 测试共用，保证测试里的「响应包裹 / 校验 / 错误体」与真机完全一致。
 * 注意：不含 CORS / listen —— 那是 main.ts 的运行时职责，对 supertest 无意义。
 */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());
  // 反代后取真实客户端 IP（Caddy 设 X-Forwarded-For），限流方能按真实 IP 计数。
  // trust proxy = 1：仅信任最靠前的一跳（Caddy），不信任更外层伪造的 XFF。
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
}
