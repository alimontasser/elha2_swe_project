import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { type AppConfig, CONFIG } from '../config/config';
import { PrismaClient } from '../generated/prisma/client';

/**
 * One database connection for the whole monolith. Each module's repository uses only the models
 * of its own schema (accounts, expiry, pantry, ai); modules read each other's data through interfaces.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(CONFIG) config: AppConfig) {
    super({ adapter: new PrismaPg({ connectionString: config.DATABASE_URL }) });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
