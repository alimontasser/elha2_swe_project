import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { ExpiryModule } from '../expiry/expiry.module';
import { PantryItemsController } from './items.controller';
import { ProductSuggestionsController } from './product-suggestions.controller';
import { ProductSuggestionsService } from './product-suggestions.service';
import { PantryItemsService } from './items.service';
import { ReceiptsController } from './receipts.controller';
import { ReceiptsService } from './receipts.service';

@Module({
  imports: [AuthModule, AiModule, ExpiryModule],
  controllers: [ReceiptsController, PantryItemsController, ProductSuggestionsController],
  providers: [ReceiptsService, PantryItemsService, ProductSuggestionsService],
  exports: [ReceiptsService],
})
export class PantryModule {}
