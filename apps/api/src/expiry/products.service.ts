import { Inject, Injectable } from '@nestjs/common';
import { type ExternalProduct, type IProduct, PRODUCT_SOURCE } from '../adapters/product.interfaces';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CATALOGUE_MATCH,
  type CatalogueCandidate,
  type CatalogueEntry,
  FOOD_CATEGORIES,
  type FoodCategory,
  type ICatalogueMatch,
  type IProductCatalogue,
  type ProductForReview,
  type ProductReviewDecision,
  type ReviewFilter,
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
export class ProductsService implements IProductCatalogue {
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(CATALOGUE_MATCH) private readonly catalogue: ICatalogueMatch,
    @Inject(PRODUCT_SOURCE) private readonly external: IProduct,
  ) {}

  private async view(row: Prisma.ProductGetPayload<object>): Promise<ProductView> {
    const entry: CatalogueEntry | undefined = row.catalogueId
      ? (await this.catalogue.byIds([row.catalogueId])).get(row.catalogueId)
      : undefined;
    const own = FOOD_CATEGORIES.find((c) => c === row.category);
    const category: FoodCategory = own ?? entry?.category ?? 'dry';
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

  /** An unknown barcode, named by a user: saved as pending until it is reviewed. Never changes a known product. */
  async suggest(suggestedBy: string, barcode: string, sug: { nameAr: string; nameEn?: string }): Promise<{ saved: boolean }> {
    const existing = await this.db.product.findUnique({ where: { barcode } });
    if (existing?.status === 'known') return { saved: false };
    const data = {
      catalogueId: null,
      category: null,
      nameAr: sug.nameAr,
      nameEn: sug.nameEn ?? null,
      quantity: null,
      unit: null,
      source: 'user' as const,
      status: 'pendingReview' as const,
      suggestedBy,
      reviewedBy: null,
      reviewNote: null,
      reviewedAt: null,
    };
    await this.db.product.upsert({ where: { barcode }, create: { barcode, ...data }, update: data });
    return { saved: true };
  }

  async applyReview(barcode: string, d: ProductReviewDecision, now = new Date()): Promise<void> {
    await this.write({ barcode, status: 'pendingReview' }, d, now);
  }

  /** An administrator may overrule the AI, but only on products a user named (not Open Food Facts ones). */
  async decide(barcode: string, d: ProductReviewDecision, now = new Date()): Promise<boolean> {
    return (await this.write({ barcode, source: 'user' }, d, now)) > 0;
  }

  private async write(where: Prisma.ProductWhereInput, d: ProductReviewDecision, now: Date): Promise<number> {
    const review = { reviewedBy: d.reviewedBy, reviewNote: d.note.slice(0, 200), reviewedAt: now };
    if (d.status === 'pendingReview') {
      // Still undecided: keep the reviewer's note for the admin who decides.
      return (await this.db.product.updateMany({ where, data: { status: 'pendingReview', reviewNote: review.reviewNote } })).count;
    }
    if (d.status === 'rejected') {
      // A rejected text is not kept: only the decision and its reason are.
      return (await this.db.product.updateMany({ where, data: { status: 'rejected', ...review, nameAr: null, nameEn: null } })).count;
    }
    return (
      await this.db.product.updateMany({
        where,
        data: {
          status: 'known',
          ...review,
          nameAr: d.nameAr,
          nameEn: d.nameEn,
          category: d.category ?? null,
          catalogueId: d.catalogueId ?? null,
          quantity: d.quantity ? new Prisma.Decimal(d.quantity) : null,
          unit: d.quantity ? (d.unit ?? null) : null,
        },
      })
    ).count;
  }

  async listForReview(filter: ReviewFilter): Promise<ProductForReview[]> {
    const where: Prisma.ProductWhereInput =
      filter === 'pending'
        ? { source: 'user', status: 'pendingReview' }
        : filter === 'aiAccepted'
          ? { source: 'user', status: 'known', reviewedBy: 'ai' }
          : filter === 'rejected'
            ? { source: 'user', status: 'rejected' }
            : { source: 'user' };
    const rows = await this.db.product.findMany({ where, orderBy: { updatedAt: 'desc' }, take: 200 });
    const names = rows.map((r) => [r.nameEn, r.nameAr].filter(Boolean).join(' ') || r.barcode);
    const candidates = names.length ? await this.catalogue.closest(names, 5) : [];
    return rows.map((r, i) => ({
      barcode: r.barcode,
      status: r.status,
      nameAr: r.nameAr,
      nameEn: r.nameEn,
      category: FOOD_CATEGORIES.find((c) => c === r.category) ?? null,
      catalogueId: r.catalogueId,
      quantity: r.quantity ? Number(r.quantity) : null,
      unit: (r.unit as Unit | null) ?? null,
      reviewedBy: r.reviewedBy,
      reviewNote: r.reviewNote,
      reviewedAt: r.reviewedAt?.toISOString() ?? null,
      suggestedAt: r.createdAt.toISOString(),
      candidates: (candidates[i] ?? [])
        .filter((c) => c.score >= 0.3)
        .map((c) => ({ id: c.id, nameAr: c.nameAr, nameEn: c.nameEn, category: c.category })),
    }));
  }
}
