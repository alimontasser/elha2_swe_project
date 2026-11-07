export const FOOD_CATEGORIES = ['bakery', 'produce', 'dairy', 'meat', 'cooked', 'dry', 'drinks'] as const;
export const UNITS = ['piece', 'kg', 'g', 'l', 'ml', 'pack', 'loaf'] as const;
export const STORAGE_PLACES = ['fridge', 'freezer', 'cupboard'] as const;

export type FoodCategory = (typeof FOOD_CATEGORIES)[number];
export type Unit = (typeof UNITS)[number];
export type StoragePlace = (typeof STORAGE_PLACES)[number];

export interface CatalogueEntry {
  id: string;
  nameAr: string;
  nameEn: string;
  category: FoodCategory;
  unit: Unit;
  defaultQuantity: number;
  defaultStorage: StoragePlace;
  shelfLifeDays: Partial<Record<StoragePlace, number>>;
}

export interface CatalogueCandidate extends CatalogueEntry {
  /** 0..1, pg_trgm word similarity between the best of the item's names and the line. */
  score: number;
}

/** Offered by Expiry: the food catalogue as matching context (AI gateway step 2). */
export interface ICatalogueMatch {
  /** The k closest catalogue items for each line, best first. */
  closest(lines: string[], k: number): Promise<CatalogueCandidate[][]>;
  byIds(ids: string[]): Promise<Map<string, CatalogueEntry>>;
}

export interface ExpiryEstimate {
  /** YYYY-MM-DD */
  date: string;
  source: 'estimated';
}

/** Offered by Expiry to Pantry (SDD §3.2.4): estimate(item, storage, purchased). */
export interface IEstimateExpiry {
  estimate(
    item: { catalogueId: string | null; category: FoodCategory },
    storage: StoragePlace,
    purchasedOn: string,
  ): Promise<ExpiryEstimate>;
}

export const CATALOGUE_MATCH = Symbol('ICatalogueMatch');
export const ESTIMATE_EXPIRY = Symbol('IEstimateExpiry');

/** A decision on a user's name for an unknown barcode (US-2.03). */
export interface ProductReviewDecision {
  status: 'known' | 'rejected' | 'pendingReview';
  reviewedBy: 'ai' | 'admin';
  note: string;
  nameAr?: string;
  nameEn?: string;
  category?: FoodCategory;
  catalogueId?: string | null;
  quantity?: number | null;
  unit?: Unit | null;
}

export const REVIEW_FILTERS = ['pending', 'aiAccepted', 'rejected', 'all'] as const;
export type ReviewFilter = (typeof REVIEW_FILTERS)[number];

/** A user-named product as an administrator reviews it. */
export interface ProductForReview {
  barcode: string;
  status: 'known' | 'pendingReview' | 'rejected';
  nameAr: string | null;
  nameEn: string | null;
  category: FoodCategory | null;
  catalogueId: string | null;
  quantity: number | null;
  unit: Unit | null;
  reviewedBy: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  suggestedAt: string;
  /** The closest catalogue items to its name, for the administrator to pick from. */
  candidates: { id: string; nameAr: string; nameEn: string; category: FoodCategory }[];
}

/** Offered by Expiry to Pantry and Administration: barcoded products and their review. */
export interface IProductCatalogue {
  /** Saves a user's name for an unknown barcode; false when the barcode is already known. */
  suggest(suggestedBy: string, barcode: string, s: { nameAr: string; nameEn?: string }): Promise<{ saved: boolean }>;
  /** Applies a review to a pending suggestion; a known product is never changed. */
  applyReview(barcode: string, decision: ProductReviewDecision): Promise<void>;
  /** User-named products for an administrator, newest first. */
  listForReview(filter: ReviewFilter): Promise<ProductForReview[]>;
  /** An administrator's decision, which may overrule the AI's. False when the barcode has no user-named product. */
  decide(barcode: string, decision: ProductReviewDecision): Promise<boolean>;
}

export const PRODUCT_CATALOGUE = Symbol('IProductCatalogue');
