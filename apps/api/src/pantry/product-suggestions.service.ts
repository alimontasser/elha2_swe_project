import { Inject, Injectable } from '@nestjs/common';
import type { Member } from '../accounts/accounts.interfaces';
import { AI, type IAI } from '../ai/ai.interfaces';
import { maskPersonalData } from '../ai/pii-masker';
import { FOOD_CATEGORIES, type IProductCatalogue, PRODUCT_CATALOGUE, type ProductReviewDecision, UNITS } from '../expiry/expiry.interfaces';

/** The AI decides on its own only when at least this sure; otherwise the suggestion waits for an admin. */
export const AUTO_DECISION_CONFIDENCE = 0.7;

/**
 * Pantry module, barcode capture (US-2.03): a user names an unknown barcode, and the AI gateway
 * reviews the name in place of an admin. Accepted products are known to everyone from the next
 * scan, where a person still sees and confirms the details before adding (NFR-30).
 */
@Injectable()
export class ProductSuggestionsService {
  constructor(
    @Inject(PRODUCT_CATALOGUE) private readonly products: IProductCatalogue,
    @Inject(AI) private readonly ai: IAI,
  ) {}

  async suggest(member: Member, barcode: string, typed: { nameAr: string; nameEn?: string }) {
    // Nothing a user types is stored with personal details in it (US-14.03).
    const [nameAr, nameEn] = maskPersonalData([typed.nameAr, typed.nameEn ?? '']).lines;
    const s = { nameAr, nameEn: nameEn || undefined };
    const { saved } = await this.products.suggest(member.userId, barcode, s);
    if (!saved) return { saved: false, status: 'known' as const };

    const review = await this.ai.reviewProduct({ barcode, name: s.nameAr }, { userId: member.userId });
    const sure = !review.fallbackUsed && review.confidence >= AUTO_DECISION_CONFIDENCE;
    let decision: ProductReviewDecision;
    if (sure && review.decision === 'accept') {
      decision = {
        status: 'known',
        reviewedBy: 'ai',
        note: review.reason,
        nameAr: review.nameAr,
        nameEn: review.nameEn,
        category: FOOD_CATEGORIES.find((c) => c === review.category),
        catalogueId: review.catalogueId,
        quantity: review.quantity,
        unit: UNITS.find((u) => u === review.unit) ?? null,
      };
    } else if (sure && review.decision === 'reject') {
      decision = { status: 'rejected', reviewedBy: 'ai', note: review.reason };
    } else {
      decision = {
        status: 'pendingReview',
        reviewedBy: 'ai',
        note: `AI ${review.fallbackUsed ? 'unavailable' : 'unsure'}: ${review.reason}`,
      };
    }
    await this.products.applyReview(barcode, decision);
    return { saved: true, status: decision.status };
  }
}
