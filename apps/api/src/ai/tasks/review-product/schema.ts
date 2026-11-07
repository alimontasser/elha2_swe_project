import { z } from 'zod';
import { FOOD_CATEGORIES, UNITS } from '../../../expiry/expiry.interfaces';

export const PRODUCT_DECISIONS = ['accept', 'reject', 'unsure'] as const;

export const ProductReviewSchema = z.object({
  decision: z.enum(PRODUCT_DECISIONS),
  /** Short, in English, for the audit trail. */
  reason: z.string().trim().max(200),
  nameAr: z.string().trim().max(60),
  nameEn: z.string().trim().max(60),
  category: z.enum(FOOD_CATEGORIES),
  /** A catalogue id copied from the offered candidates, or "". */
  catalogueId: z.string().max(80),
  /** Pack size; 0 when the name gives none. */
  quantity: z.number().min(0).max(10000),
  unit: z.enum(UNITS),
  confidence: z.number().min(0).max(1),
});

export type ProductReview = z.infer<typeof ProductReviewSchema>;

export const PRODUCT_REVIEW_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    decision: { type: 'string', enum: [...PRODUCT_DECISIONS] },
    reason: { type: 'string', description: 'Short reason in English' },
    nameAr: { type: 'string', description: 'Everyday Egyptian Arabic name, with the brand if given' },
    nameEn: { type: 'string', description: 'English name, with the brand if given' },
    category: { type: 'string', enum: [...FOOD_CATEGORIES] },
    catalogueId: { type: 'string', description: 'Id of the matching candidate, or an empty string' },
    quantity: { type: 'number', description: 'Pack size from the name, or 0' },
    unit: { type: 'string', enum: [...UNITS] },
    confidence: { type: 'number', description: 'Probability from 0 to 1 that the decision and details are right' },
  },
  required: ['decision', 'reason', 'nameAr', 'nameEn', 'category', 'catalogueId', 'quantity', 'unit', 'confidence'],
};
