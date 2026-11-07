import { z } from 'zod';

/**
 * US-4.02. Until the pantry syncs to the server, the app sends the items it shows; the Recipes
 * module will read them through IPantryQuery instead once it does (SDD §3.2.4).
 */
export const AskAssistantBody = z.object({
  question: z.string().trim().min(1).max(500),
  language: z.enum(['ar', 'en']).default('ar'),
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(60),
        daysLeft: z.number().int().min(-60).max(3650),
        cooked: z.boolean().optional(),
      }),
    )
    .max(80)
    .default([]),
  householdSize: z.number().int().min(1).max(30).optional(),
  allergies: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  diet: z.string().trim().max(40).optional(),
});
