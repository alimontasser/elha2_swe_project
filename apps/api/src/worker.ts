import { Logger, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { loadConfig } from './config/config';
import { ConfigModule } from './config/config.module';
import { PantryModule } from './pantry/pantry.module';
import { ReceiptsService } from './pantry/receipts.service';
import { PrismaModule } from './prisma/prisma.module';

// The Scheduler worker (SDD v1.1 Fig. 3.2): a separate process from the API instances, so timed
// work is retried by pg-boss (3 times, NFR-19) and never runs twice when the API scales out.

export const PURGE_RECEIPT_DRAFTS = 'pantry.purge-receipt-drafts';

async function main() {
  const config = loadConfig();
  const logger = new Logger('Scheduler');

  @Module({ imports: [ConfigModule.forRoot(config), PrismaModule, PantryModule] })
  class WorkerModule {}

  const app = await NestFactory.createApplicationContext(WorkerModule);
  const receipts = app.get(ReceiptsService);

  // pg-boss is an ES module; this file compiles to CommonJS, so it is loaded with import().
  const { PgBoss } = await import('pg-boss');
  const boss = new PgBoss(config.DATABASE_URL);
  boss.on('error', (error) => logger.error(error.message));
  await boss.start();

  await boss.createQueue(PURGE_RECEIPT_DRAFTS, { retryLimit: 3 });
  await boss.schedule(PURGE_RECEIPT_DRAFTS, '15 * * * *', null, { tz: 'Africa/Cairo' });
  await boss.work(PURGE_RECEIPT_DRAFTS, async () => {
    const count = await receipts.purgeExpiredDrafts();
    logger.log(`Deleted ${count} receipt draft(s) older than 24 hours`);
  });
  logger.log('Scheduler worker started');

  const stop = async () => {
    await boss.stop();
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void stop());
  process.on('SIGINT', () => void stop());
}

void main();
