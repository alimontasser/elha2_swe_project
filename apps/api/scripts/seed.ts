// Seeds the food catalogue (single source: apps/mobile/assets/catalogue.json) and the AI gateway's
// worked examples (the labelled receipts in docs/ai-testset/receipts). Safe to run again.
//   pnpm db:seed
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { maskPersonalData } from '../src/ai/pii-masker';
import { normaliseForMatch } from '../src/common/text';
import { loadConfig } from '../src/config/config';
import { PrismaClient } from '../src/generated/prisma/client';

const ROOT = join(__dirname, '..', '..', '..');

interface CatalogueJson {
  items: {
    id: string;
    nameAr: string;
    nameEn: string;
    category: string;
    unit: string;
    defaultQuantity: number;
    defaultStorage: string;
    shelfLifeDays: Record<string, number>;
    receiptAliases: string[];
  }[];
}

export interface LabelledReceipt {
  id: string;
  shopName?: string;
  lines: string[];
  expected: {
    line: number;
    catalogueId: string | null;
    nameAr: string;
    nameEn: string;
    quantity: number;
    unit: string;
    category: string;
  }[];
}

export function loadLabelledReceipts(): LabelledReceipt[] {
  const dir = join(ROOT, 'docs', 'ai-testset', 'receipts');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as LabelledReceipt);
}

export function searchText(item: CatalogueJson['items'][number]): string {
  const terms = [item.nameAr, item.nameEn, ...item.receiptAliases].map(normaliseForMatch).filter(Boolean);
  return [...new Set(terms)].join('|');
}

async function main() {
  const config = loadConfig();
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.SEED_DATABASE_URL ?? config.DATABASE_URL }) });
  try {
    const catalogue = JSON.parse(readFileSync(join(ROOT, 'apps', 'mobile', 'assets', 'catalogue.json'), 'utf8')) as CatalogueJson;
    for (const item of catalogue.items) {
      const data = {
        nameAr: item.nameAr,
        nameEn: item.nameEn,
        category: item.category as never,
        unit: (item.unit === 'L' ? 'l' : item.unit) as never,
        defaultQuantity: item.defaultQuantity,
        defaultStorage: item.defaultStorage as never,
        shelfLifeFridge: item.shelfLifeDays.fridge ?? null,
        shelfLifeFreezer: item.shelfLifeDays.freezer ?? null,
        shelfLifeCupboard: item.shelfLifeDays.cupboard ?? null,
        receiptAliases: item.receiptAliases,
        searchText: searchText(item),
        retiredAt: null,
      };
      await db.foodCatalogueItem.upsert({ where: { id: item.id }, create: { id: item.id, ...data }, update: data });
    }

    const receipts = loadLabelledReceipts();
    await db.aiExample.deleteMany({ where: { task: 'parseReceipt', source: 'testset' } });
    for (const r of receipts) {
      const lines = maskPersonalData(r.lines.map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean)).lines;
      const items = r.expected.map((e) => ({ ...e, catalogueId: e.catalogueId ?? '', confidence: 0.95 }));
      await db.aiExample.create({ data: { task: 'parseReceipt', source: 'testset', input: { lines }, output: { items } } });
    }
    console.log(`Seeded ${catalogue.items.length} catalogue items and ${receipts.length} worked examples`);
  } finally {
    await db.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
