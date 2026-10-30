import { addDays } from '../common/text';
import type { CatalogueEntry, FoodCategory, StoragePlace } from './expiry.interfaces';

/** Conservative shelf lives for food that is not in the catalogue yet. */
const CATEGORY_DEFAULT_DAYS: Record<FoodCategory, Partial<Record<StoragePlace, number>>> = {
  bakery: { cupboard: 2, fridge: 5, freezer: 60 },
  produce: { cupboard: 3, fridge: 5, freezer: 180 },
  dairy: { fridge: 5, freezer: 60 },
  meat: { fridge: 2, freezer: 90 },
  cooked: { fridge: 3, freezer: 60 },
  dry: { cupboard: 180, fridge: 180, freezer: 365 },
  drinks: { cupboard: 30, fridge: 7, freezer: 90 },
};

/** Where an item goes when the catalogue does not say. */
export const CATEGORY_DEFAULT_STORAGE: Record<FoodCategory, StoragePlace> = {
  bakery: 'cupboard',
  produce: 'fridge',
  dairy: 'fridge',
  meat: 'fridge',
  cooked: 'fridge',
  dry: 'cupboard',
  drinks: 'cupboard',
};

function baseShelfLife(days: Partial<Record<StoragePlace, number>>, storage: StoragePlace, fallback: StoragePlace): number {
  return days[storage] ?? days[fallback] ?? Math.min(...Object.values(days).filter((d): d is number => d !== undefined));
}

/**
 * Rule-based estimate (SDD v1.0 Algorithm 3; the same rule as apps/mobile/lib/core/expiry_rules.dart):
 * the base shelf life for the storage place, cut by the summer factor outside the freezer from May to
 * September. The ML shelf-life model refines it in Sprint 2 (US-3.01).
 */
export function estimateExpiryDate(
  item: { entry: CatalogueEntry | null; category: FoodCategory },
  storage: StoragePlace,
  purchasedOn: string,
  summerFactor = 0.8,
): string {
  const days = item.entry
    ? baseShelfLife(item.entry.shelfLifeDays, storage, item.entry.defaultStorage)
    : baseShelfLife(CATEGORY_DEFAULT_DAYS[item.category], storage, CATEGORY_DEFAULT_STORAGE[item.category]);
  const month = Number(purchasedOn.slice(5, 7));
  const isSummer = month >= 5 && month <= 9;
  const adjusted = storage !== 'freezer' && isSummer ? Math.max(1, Math.floor(days * summerFactor)) : days;
  return addDays(purchasedOn, adjusted);
}
