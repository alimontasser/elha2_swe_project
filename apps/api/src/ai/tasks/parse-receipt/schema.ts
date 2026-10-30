import { z } from 'zod';
import { FOOD_CATEGORIES, UNITS } from '../../../expiry/expiry.interfaces';

export const ParsedItemSchema = z.object({
  line: z.number().int().min(0),
  /** A catalogue id copied from the line's candidates, or "" when none fits. */
  catalogueId: z.string().max(80),
  nameAr: z.string().trim().min(1).max(60),
  nameEn: z.string().trim().min(1).max(60),
  quantity: z.number().positive().max(1000),
  unit: z.enum(UNITS),
  category: z.enum(FOOD_CATEGORIES),
  confidence: z.number().min(0).max(1),
});

export const ParseReceiptOutputSchema = z.object({
  items: z.array(ParsedItemSchema).max(80),
});

export type ParsedItem = z.infer<typeof ParsedItemSchema>;
export type ParseReceiptOutput = z.infer<typeof ParseReceiptOutputSchema>;

/**
 * The same answer format as JSON Schema, written by hand so it stays inside the subset
 * that Gemini's responseJsonSchema and OpenAI-style JSON mode both accept.
 */
export const PARSE_RECEIPT_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          line: { type: 'integer', description: 'Index of the receipt line, as in L<index>' },
          catalogueId: { type: 'string', description: 'Id of the matching candidate, or an empty string' },
          nameAr: { type: 'string' },
          nameEn: { type: 'string' },
          quantity: { type: 'number' },
          unit: { type: 'string', enum: [...UNITS] },
          category: { type: 'string', enum: [...FOOD_CATEGORIES] },
          confidence: { type: 'number', description: 'Probability from 0 to 1 that name, quantity and unit are right' },
        },
        required: ['line', 'catalogueId', 'nameAr', 'nameEn', 'quantity', 'unit', 'category', 'confidence'],
      },
    },
  },
  required: ['items'],
};
