// Live check of the AI gateway against the real providers: reads one labelled receipt and prints
// what came back. Never prints keys. Clears cached receipt answers first so the call is real.
//   pnpm smoke:gemini [receipt-id]
import { NestFactory } from '@nestjs/core';
import { AI, type IAI } from '../src/ai/ai.interfaces';
import { AppModule } from '../src/app.module';
import { loadConfig } from '../src/config/config';
import { PrismaService } from '../src/prisma/prisma.service';
import { loadLabelledReceipts } from './seed';

const SMOKE_USER = '00000000-0000-4000-8000-000000000001';

async function main() {
  const config = loadConfig();
  const app = await NestFactory.createApplicationContext(AppModule.forRoot(config), { logger: ['warn', 'error'] });
  try {
    const receipts = loadLabelledReceipts();
    const receipt = receipts.find((r) => r.id === process.argv[2]) ?? receipts[0];
    await app.get(PrismaService).aiResponseCache.deleteMany({ where: { task: 'parseReceipt' } });

    const started = Date.now();
    const reading = await app.get<IAI>(AI).parseReceipt(receipt.lines, { userId: SMOKE_USER, shopName: receipt.shopName });
    const ms = Date.now() - started;

    console.log(`receipt ${receipt.id}: provider ${reading.provider}, prompt v${reading.promptVersion}, ${ms} ms, fallback ${reading.fallbackUsed}`);
    for (const item of reading.items) {
      const id = item.catalogueId || '-';
      console.log(`  L${item.line}  ${item.nameEn} / ${item.nameAr}  ${item.quantity} ${item.unit}  ${item.category}  ${id}  ${Math.round(item.confidence * 100)}%`);
    }
    if (reading.fallbackUsed) process.exitCode = 1;
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
