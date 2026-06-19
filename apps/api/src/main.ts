import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import type { AppConfig } from './config/configuration';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // 全局管线（与 e2e 测试共用，见 app.setup.ts）
  configureApp(app);
  app.enableCors({ origin: config.get<AppConfig['webOrigin']>('webOrigin') ?? true, credentials: true });

  const port = config.get<number>('port') ?? 3001;
  await app.listen(port);
  Logger.log(`信逢 Inkling API · http://localhost:${port}/v1`, 'Bootstrap');
}

bootstrap();
