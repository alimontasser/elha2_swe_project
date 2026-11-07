import { z } from 'zod';

export const CookingAnswerSchema = z.object({
  /** False when the question is not about cooking, food storage or food safety. */
  onTopic: z.boolean(),
  answer: z.string().trim().min(1).max(1500),
  /** One sentence on reheating leftovers safely, or "" when no leftovers are involved. */
  reheatingNote: z.string().trim().max(400),
  /** Pantry items the answer uses, named as in the pantry list. */
  usedItems: z.array(z.string().trim().max(60)).max(20),
});

export type CookingAnswer = z.infer<typeof CookingAnswerSchema>;

export const COOKING_ANSWER_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    onTopic: { type: 'boolean', description: 'False for anything that is not cooking, food storage or food safety' },
    answer: { type: 'string', description: 'The reply, in the language of the question, at most 6 sentences' },
    reheatingNote: { type: 'string', description: 'One reheating safety sentence when leftovers are involved, else ""' },
    usedItems: { type: 'array', items: { type: 'string' }, description: 'Pantry items used, exactly as listed' },
  },
  required: ['onTopic', 'answer', 'reheatingNote', 'usedItems'],
};
