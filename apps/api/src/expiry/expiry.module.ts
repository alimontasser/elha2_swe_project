import { Module } from '@nestjs/common';
import { OpenFoodFactsAdapter } from '../adapters/open-food-facts.adapter';
import { PRODUCT_SOURCE } from '../adapters/product.interfaces';
import { AuthModule } from '../auth/auth.module';
import { type AppConfig, CONFIG } from '../config/config';
import { CatalogueRepository } from './catalogue.repository';
import { CATALOGUE_MATCH, ESTIMATE_EXPIRY, PRODUCT_CATALOGUE } from './expiry.interfaces';
import { ExpiryService } from './expiry.service';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [AuthModule],
  controllers: [ProductsController],
  providers: [
    CatalogueRepository,
    ExpiryService,
    ProductsService,
    { provide: CATALOGUE_MATCH, useExisting: CatalogueRepository },
    { provide: ESTIMATE_EXPIRY, useExisting: ExpiryService },
    { provide: PRODUCT_CATALOGUE, useExisting: ProductsService },
    { provide: PRODUCT_SOURCE, inject: [CONFIG], useFactory: (c: AppConfig) => new OpenFoodFactsAdapter(c.OPEN_FOOD_FACTS_URL) },
  ],
  exports: [CATALOGUE_MATCH, ESTIMATE_EXPIRY, PRODUCT_CATALOGUE],
})
export class ExpiryModule {}
