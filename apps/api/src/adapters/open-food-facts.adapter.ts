import { Logger } from '@nestjs/common';
import type { IProduct, ProductLookupResult } from './product.interfaces';

type Fetch = typeof fetch;

interface OffResponse {
  status?: number;
  product?: {
    product_name?: string;
    product_name_ar?: string;
    product_name_en?: string;
    generic_name?: string;
    brands?: string;
    quantity?: string;
    categories_tags_en?: string[];
  };
}

const FIELDS = 'product_name,product_name_ar,product_name_en,generic_name,brands,quantity,categories_tags_en';
const clean = (v?: string) => (v && v.trim() ? v.trim().slice(0, 80) : undefined);
const isArabic = (v?: string) => !!v && /[؀-ۿ]/.test(v);

/**
 * Open Food Facts (free, no key): https://world.openfoodfacts.org. It asks API users to name their
 * app in the User-Agent. The 1.5 s limit keeps the whole scan within US-2.03's 2 s.
 */
export class OpenFoodFactsAdapter implements IProduct {
  private readonly logger = new Logger('OpenFoodFacts');

  constructor(
    private readonly baseUrl = 'https://world.openfoodfacts.org',
    private readonly timeoutMs = 1500,
    private readonly fetchFn: Fetch = fetch,
  ) {}

  async lookup(barcode: string): Promise<ProductLookupResult> {
    try {
      const res = await this.fetchFn(`${this.baseUrl}/api/v2/product/${barcode}.json?fields=${FIELDS}`, {
        headers: { 'user-agent': 'Elha2/0.1 (AUC software engineering course project)' },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (res.status === 404) return { status: 'missing' };
      if (!res.ok) return { status: 'failed' };
      const body = (await res.json()) as OffResponse;
      const p = body.product;
      if (body.status !== 1 || !p) return { status: 'missing' };
      const main = clean(p.product_name);
      return {
        status: 'found',
        product: {
          nameAr: clean(p.product_name_ar) ?? (isArabic(main) ? main : undefined),
          nameEn: clean(p.product_name_en) ?? (main && !isArabic(main) ? main : clean(p.generic_name)),
          brand: clean(p.brands?.split(',')[0]),
          quantityText: clean(p.quantity),
          categories: (p.categories_tags_en ?? []).slice(0, 8),
        },
      };
    } catch (e) {
      this.logger.warn(`lookup failed: ${(e as Error).name}`);
      return { status: 'failed' };
    }
  }
}
