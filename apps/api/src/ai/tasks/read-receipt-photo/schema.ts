import { z } from 'zod';

export const ReceiptTextSchema = z.object({
  /** The printed lines, top to bottom; empty when the photo is not a readable receipt. */
  lines: z.array(z.string().max(300)).max(200),
});

export type ReceiptText = z.infer<typeof ReceiptTextSchema>;

export const RECEIPT_TEXT_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    lines: { type: 'array', items: { type: 'string' }, description: 'Every printed line, top to bottom, as printed' },
  },
  required: ['lines'],
};
