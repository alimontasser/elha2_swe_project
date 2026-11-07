import { z } from 'zod';
import { FOOD_CATEGORIES, STORAGE_PLACES, UNITS } from '../expiry/expiry.interfaces';
import { isoDate } from './receipts.schemas';

export const ITEM_STATUSES = ['inStock', 'used', 'donated', 'wasted'] as const;
export const WASTE_REASONS = ['spoiled', 'forgotten', 'cookedTooMuch', 'other'] as const;
export const EXPIRY_SOURCES = ['printed', 'estimated', 'userSet'] as const;
export const CAPTURE_METHODS = ['receipt', 'barcode', 'order', 'photo', 'voice', 'manual'] as const;

const editable = {
  nameAr: z.string().trim().min(1).max(60),
  nameEn: z.string().trim().min(1).max(60),
  quantity: z.number().positive().max(10000),
  unit: z.enum(UNITS),
  storage: z.enum(STORAGE_PLACES),
  expiryDate: isoDate,
  expirySource: z.enum(EXPIRY_SOURCES),
  status: z.enum(ITEM_STATUSES),
  wasteReason: z.enum(WASTE_REASONS).nullable(),
  wasteNote: z.string().trim().max(200).nullable(),
};

/** US-2.07 and every other capture method: the app sends its own id so a retry or Undo hits the same item. */
export const CreatePantryItemBody = z.object({
  id: z.uuid(),
  catalogueId: z.string().max(80).nullable().default(null),
  category: z.enum(FOOD_CATEGORIES),
  addedBy: z.enum(CAPTURE_METHODS),
  ...editable,
  status: editable.status.default('inStock'),
  wasteReason: editable.wasteReason.default(null),
  wasteNote: editable.wasteNote.default(null),
});

/** US-2.10, 2.11 and edits: any subset of the editable fields. */
export const UpdatePantryItemBody = z.object(editable).partial();

export type CreatePantryItem = z.infer<typeof CreatePantryItemBody>;
export type UpdatePantryItem = z.infer<typeof UpdatePantryItemBody>;
