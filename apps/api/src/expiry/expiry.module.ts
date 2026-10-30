import { Module } from '@nestjs/common';
import { CatalogueRepository } from './catalogue.repository';
import { CATALOGUE_MATCH, ESTIMATE_EXPIRY } from './expiry.interfaces';
import { ExpiryService } from './expiry.service';

@Module({
  providers: [
    CatalogueRepository,
    ExpiryService,
    { provide: CATALOGUE_MATCH, useExisting: CatalogueRepository },
    { provide: ESTIMATE_EXPIRY, useExisting: ExpiryService },
  ],
  exports: [CATALOGUE_MATCH, ESTIMATE_EXPIRY],
})
export class ExpiryModule {}
