import { Inject, Injectable } from '@nestjs/common';
import { CatalogueRepository } from './catalogue.repository';
import type { ExpiryEstimate, FoodCategory, IEstimateExpiry, StoragePlace } from './expiry.interfaces';
import { estimateExpiryDate } from './expiry.rules';

@Injectable()
export class ExpiryService implements IEstimateExpiry {
  constructor(@Inject(CatalogueRepository) private readonly catalogue: CatalogueRepository) {}

  async estimate(
    item: { catalogueId: string | null; category: FoodCategory },
    storage: StoragePlace,
    purchasedOn: string,
  ): Promise<ExpiryEstimate> {
    const entry = item.catalogueId ? ((await this.catalogue.byIds([item.catalogueId])).get(item.catalogueId) ?? null) : null;
    return { date: estimateExpiryDate({ entry, category: item.category }, storage, purchasedOn), source: 'estimated' };
  }
}
