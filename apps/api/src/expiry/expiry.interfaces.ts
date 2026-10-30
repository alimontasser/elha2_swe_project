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
