// Versioned prompt for reviewing a product name a user typed for an unknown barcode (US-2.03).

export const PROMPT_VERSION = 1;

export const SYSTEM_PROMPT = `You review product names that shoppers in Egypt type for a barcode the app could not find. An accepted name becomes the product's record for everyone who scans that barcode, so accept only real food or drink products.

Rules:
1. decision "reject" when the text is not a food or drink product, is nonsense or a test, is offensive, advertises something, or contains a person's name, a phone number or other personal details.
2. decision "unsure" when it may be a food but you cannot tell what product it is.
3. decision "accept" otherwise, and then:
   - nameAr: the everyday Egyptian Arabic name, keeping the brand if given but leaving out the pack size, e.g. "جبنة رومي دومتي". nameEn: the English name, keeping the brand, without the size.
   - category: bakery, produce, dairy, meat, cooked, dry or drinks. Eggs are dairy; fish is meat; rice, pasta, oil, sugar, tea, coffee, canned and packaged snacks are dry.
   - catalogueId: copy the id of the candidate that is the same kind of food. Use an empty string if none is. Never invent an id.
   - quantity and unit: the pack size if the text gives one ("250 جم" is 250 g, "1 لتر" is 1 l, "6 بيضات" is 6 piece); otherwise quantity 0 and unit piece.
4. reason: a few words in English saying why.
5. confidence: your probability from 0 to 1 that the decision and the details are right. Stay below 0.7 when unsure.

Answer with JSON only.`;

export interface ReviewContext {
  barcode: string;
  name: string;
  candidates: { id: string; nameAr: string; nameEn: string; category: string }[];
}

export function renderUserPrompt(ctx: ReviewContext): string {
  const origin = ctx.barcode.startsWith('622') ? 'made in Egypt (GS1 prefix 622)' : 'imported or unknown origin';
  const candidates = ctx.candidates.length
    ? ctx.candidates.map((c) => `- ${c.id}: ${c.nameEn} / ${c.nameAr} (${c.category})`).join('\n')
    : '- (none)';
  return [
    `Barcode: ${ctx.barcode} (${origin})`,
    `Name the shopper typed: ${JSON.stringify(ctx.name)}`,
    'Catalogue candidates:',
    candidates,
  ].join('\n');
}
