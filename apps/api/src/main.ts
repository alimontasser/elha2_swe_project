import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ErrorFilter } from './common/errors';
import { loadConfig } from './config/config';

export function configureApp(app: Awaited<ReturnType<typeof NestFactory.create>>) {
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });
  app.useGlobalFilters(new ErrorFilter());
  // The apps call the API from other origins during development (Flutter web, Vite).
  app.enableCors({ origin: true });
  return app;
}

async function bootstrap() {
  const config = loadConfig();
  const app = configureApp(await NestFactory.create(AppModule.forRoot(config)));
  app.enableShutdownHooks();
  await app.listen(config.PORT);
}

void bootstrap();
