import { DynamicModule, Module } from '@nestjs/common';
import type { AppConfig } from './config/config';
import { ConfigModule } from './config/config.module';
import { HealthController } from './health/health.controller';
import { PantryModule } from './pantry/pantry.module';
import { PrismaModule } from './prisma/prisma.module';

/** The modular monolith (SDD v1.1 §3.1.3). Feature modules join here as they are built. */
@Module({})
export class AppModule {
  static forRoot(config?: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [ConfigModule.forRoot(config), PrismaModule, PantryModule],
      controllers: [HealthController],
    };
  }
}
