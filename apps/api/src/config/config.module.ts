import { DynamicModule, Global, Module } from '@nestjs/common';
import { type AppConfig, CONFIG, loadConfig } from './config';

@Global()
@Module({})
export class ConfigModule {
  /** Pass a config in tests; otherwise it is read from the environment. */
  static forRoot(config?: AppConfig): DynamicModule {
    return {
      module: ConfigModule,
      providers: [{ provide: CONFIG, useFactory: () => config ?? loadConfig() }],
      exports: [CONFIG],
    };
  }
}
