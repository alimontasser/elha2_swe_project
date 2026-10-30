import { z } from 'zod';
import { FOOD_CATEGORIES, STORAGE_PLACES, UNITS } from '../expiry/expiry.interfaces';

export const ScanReceiptBody = z.object({
  /** OCR lines, already masked on the phone (US-14.03). */
  lines: z.array(z.string().max(500)).min(1).max(200),
  shopName: z.string().max(80).optional(),
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

/** One reviewed item as the app sends it back on "Confirm all" (US-2.02). */
export const ConfirmedItem = z.object({
  id: z.string().min(1).max(64),
  catalogueId: z.string().max(80).nullable(),
  nameAr: z.string().trim().min(1).max(60),
  nameEn: z.string().trim().min(1).max(60),
  quantity: z.number().positive().max(1000),
  unit: z.enum(UNITS),
  category: z.enum(FOOD_CATEGORIES),
  storage: z.enum(STORAGE_PLACES),
  expiryDate: isoDate,
});

export const ConfirmReceiptBody = z.object({
  items: z.array(ConfirmedItem).max(80),
});

export type ScanReceiptRequest = z.infer<typeof ScanReceiptBody>;
export type ConfirmReceiptRequest = z.infer<typeof ConfirmReceiptBody>;
export type ConfirmedItemData = z.infer<typeof ConfirmedItem>;

/** A draft item as stored and returned to the review screen. */
export interface DraftItem {
  id: string;
  sourceLine: string;
  catalogueId: string | null;
  nameAr: string;
  nameEn: string;
  quantity: number;
  unit: (typeof UNITS)[number];
  category: (typeof FOOD_CATEGORIES)[number];
  storage: (typeof STORAGE_PLACES)[number];
  expiryDate: string;
  expirySource: 'estimated';
  confidence: number;
}
