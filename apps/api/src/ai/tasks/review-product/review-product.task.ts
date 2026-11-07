import type { CatalogueCandidate, ICatalogueMatch } from '../../../expiry/expiry.interfaces';
import { maskPersonalData } from '../../pii-masker';
import type { AiTask, PreparedPrompt } from '../../task-runner';
import { stripForeignScripts } from '../../text-cleanup';
import { PROMPT_VERSION, renderUserPrompt, SYSTEM_PROMPT } from './prompt.v1';
import { PRODUCT_REVIEW_JSON_SCHEMA, type ProductReview, ProductReviewSchema } from './schema';

export interface ProductReviewInput {
  barcode: string;
  /** What the user typed for the unknown barcode. */
  name: string;
}

interface State {
  candidates: CatalogueCandidate[];
}

const MIN_CANDIDATE_SCORE = 0.3;
const PERSONAL = /\[(name|phone|card|email)\]/;

/**
 * US-2.03: reviews a name a user gave an unknown barcode, in place of an admin. Accepted names are
 * cleaned up and matched to the catalogue; the next person who scans the barcode still sees the
 * details and confirms them before anything is added (NFR-30).
 */
export class ReviewProductTask implements AiTask<ProductReviewInput, ProductReview, State> {
  readonly name = 'reviewProduct';
  readonly promptVersion = PROMPT_VERSION;
  readonly schema = ProductReviewSchema;
  readonly jsonSchema = PRODUCT_REVIEW_JSON_SCHEMA;

  constructor(private readonly catalogue: ICatalogueMatch) {}

  sanitise(input: ProductReviewInput) {
    const masked = maskPersonalData([input.name.replace(/\s+/g, ' ').trim().slice(0, 80)]);
    return { input: { barcode: input.barcode, name: masked.lines[0] }, maskedCount: masked.maskedCount };
  }

  canonical(input: ProductReviewInput): string {
    return JSON.stringify([input.barcode, input.name]);
  }

  async prepare(input: ProductReviewInput): Promise<PreparedPrompt<State>> {
    const candidates = ((await this.catalogue.closest([input.name], 5))[0] ?? []).filter((c) => c.score >= MIN_CANDIDATE_SCORE);
    return {
      system: SYSTEM_PROMPT,
      user: renderUserPrompt({
        barcode: input.barcode,
        name: input.name,
        candidates: candidates.map((c) => ({ id: c.id, nameAr: c.nameAr, nameEn: c.nameEn, category: c.category })),
      }),
      state: { candidates },
    };
  }

  check(output: ProductReview, input: ProductReviewInput, state: State): ProductReview {
    if (PERSONAL.test(input.name)) {
      return { ...output, decision: 'reject', reason: 'contains personal details', confidence: 1 };
    }
    if (output.decision !== 'accept') return output;
    const nameAr = stripForeignScripts(output.nameAr).trim();
    const nameEn = stripForeignScripts(output.nameEn).trim();
    if (!nameAr || !nameEn) return { ...output, decision: 'unsure', reason: 'no usable name', confidence: 0 };
    const offered = state.candidates.some((c) => c.id === output.catalogueId);
    return { ...output, nameAr, nameEn, catalogueId: offered ? output.catalogueId : '' };
  }

  /** Without a model the suggestion simply waits for a person. */
  fallback(): ProductReview {
    return {
      decision: 'unsure',
      reason: 'AI unavailable',
      nameAr: '',
      nameEn: '',
      category: 'dry',
      catalogueId: '',
      quantity: 0,
      unit: 'piece',
      confidence: 0,
    };
  }

  confidence(output: ProductReview): number {
    return output.confidence;
  }
}
