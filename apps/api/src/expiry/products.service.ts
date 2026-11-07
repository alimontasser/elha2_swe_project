import { Inject, Injectable } from '@nestjs/common';
import type { Member } from '../accounts/accounts.interfaces';
import { type ExternalProduct, type IProduct, PRODUCT_SOURCE } from '../adapters/product.interfaces';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CATALOGUE_MATCH,
  type CatalogueCandidate,
  type CatalogueEntry,
  type FoodCategory,
  type ICatalogueMatch,
  type StoragePlace,
  type Unit,
} from './expiry.interfaces';
import { CATEGORY_DEFAULT_STORAGE } from './expiry.rules';

/** Below this, the product is kept without a catalogue item rather than matched to the wrong one. */
export const MIN_MATCH_SCORE = 0.6;

export type ProductView =
  | {
      barcode: string;
      found: true;
      nameAr: string;
      nameEn: string;
      brand: string | null;
      catalogueId: string | null;
      category: FoodCategory;
      unit: Unit;
      quantity: number;
      storage: StoragePlace;
    }
  | { barcode: string; found: false; lookupFailed: boolean };

export interface Suggestion {
  nameAr: string;
  nameEn?: string;
  catalogueId?: string | null;
  quantity?: number;
  unit?: Unit;
}

/** "1 l", "400 g", "33 cl", "1.5L" → quantity and unit; null when the text has no size. */
export function parseQuantity(text?: string): { quantity: number; unit: Unit } | null {
  const m = /([\d]+(?:[.,]\d+)?)\s*(kg|g|l|ml|cl)\b/i.exec(text ?? '');
  if (!m) return null;
  const n = Number(m[1].replace(',', '.'));
  const unit = m[2].toLowerCase();
  if (!(n > 0)) return null;
  if (unit === 'cl') return { quantity: n * 10, unit: 'ml' };
  return { quantity: n, unit: unit as Unit };
}

/** Expiry module: barcoded products (US-2.03), our table first, then the open product database. */
@Injectable()
export class ProductsService {
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(CATALOGUE_MATCH) private readonly catalogue: ICatalogueMatch,
    @Inject(PRODUCT_SOURCE) private readonly external: IProduct,
  ) {}

  private async view(row: Prisma.ProductGetPayload<object>): Promise<ProductView> {
    const entry: CatalogueEntry | undefined = row.catalogueId
      ? (await this.catalogue.byIds([row.catalogueId])).get(row.catalogueId)
      : undefined;
    const category: FoodCategory = entry?.category ?? 'dry';
    return {
      barcode: row.barcode,
      found: true,
      nameAr: row.nameAr ?? entry?.nameAr ?? row.nameEn ?? row.barcode,
      nameEn: row.nameEn ?? entry?.nameEn ?? row.nameAr ?? row.barcode,
      brand: row.brand,
      catalogueId: entry?.id ?? null,
      category,
      unit: (row.unit as Unit | null) ?? entry?.unit ?? 'piece',
      quantity: row.quantity ? Number(row.quantity) : (entry?.defaultQuantity ?? 1),
      storage: entry?.defaultStorage ?? CATEGORY_DEFAULT_STORAGE[category],
    };
  }

  /**
   * The catalogue item for a product, from the most telling evidence first: its categories, most
   * specific first ("whole milks" before "dairies"); then the English name's last word, which is
   * the head noun ("Full Cream Milk" is milk, not cream); then the whole name.
   */
  private async matchCatalogue(p: ExternalProduct): Promise<CatalogueCandidate | undefined> {
    // Sizes such as "1L" or "400g" are not words of the name.
    const words = (p.nameEn ?? '').split(/\s+/).filter((w) => w && !/^\d/.test(w));
    // Untranslated tags ("fr:Nutella", "Pâtes à tartiner") would match the wrong food.
    const categories = p.categories.filter((c) => /^[A-Za-z][A-Za-z -]*$/.test(c));
    const evidence = [
      ...categories.reverse().map((c) => c.replace(/-/g, ' ')),
      words.slice(-1).join(' '),
      words.slice(-2).join(' '),
      p.nameEn,
      p.nameAr,
    ].filter((e): e is string => !!e && e.trim().length > 1);
    const unique = [...new Set(evidence)];
    if (unique.length === 0) return undefined;
    const best = (await this.catalogue.closest(unique, 1)).map((candidates) => candidates[0]);
    return best.find((c) => c && c.score >= MIN_MATCH_SCORE);
  }

  async lookup(barcode: string): Promise<ProductView> {
    const known = await this.db.product.findUnique({ where: { barcode } });
    if (known?.status === 'known') return this.view(known);

    const result = await this.external.lookup(barcode);
    if (result.status !== 'found') return { barcode, found: false, lookupFailed: result.status === 'failed' };
    const p = result.product;
    const match = await this.matchCatalogue(p);
    const size = parseQuantity(p.quantityText) ?? parseQuantity(p.nameEn);
    const data = {
      catalogueId: match?.id ?? null,
      nameAr: p.nameAr ?? match?.nameAr ?? null,
      nameEn: p.nameEn ?? match?.nameEn ?? null,
      brand: p.brand ?? null,
      quantity: size ? new Prisma.Decimal(size.quantity) : null,
      unit: size?.unit ?? null,
      source: 'openFoodFacts' as const,
      status: 'known' as const,
    };
    // Kept, so the next scan of this barcode is answered locally (and a pending suggestion is replaced).
    const row = await this.db.product.upsert({ where: { barcode }, create: { barcode, ...data }, update: { ...data, suggestedBy: null } });
    return this.view(row);
  }

  /** An unknown barcode, named by a user: saved for an admin to review. Never changes a known product. */
  async suggest(member: Member, barcode: string, s: Suggestion): Promise<{ saved: boolean }> {
    const existing = await this.db.product.findUnique({ where: { barcode } });
    if (existing?.status === 'known') return { saved: false };
    const data = {
      catalogueId: s.catalogueId ?? null,
      nameAr: s.nameAr,
      nameEn: s.nameEn ?? null,
      quantity: s.quantity === undefined ? null : new Prisma.Decimal(s.quantity),
      unit: s.unit ?? null,
      source: 'user' as const,
      status: 'pendingReview' as const,
      suggestedBy: member.userId,
    };
    await this.db.product.upsert({ where: { barcode }, create: { barcode, ...data }, update: data });
    return { saved: true };
  }
}
