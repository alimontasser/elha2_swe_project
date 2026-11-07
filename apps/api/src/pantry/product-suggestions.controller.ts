import { Body, Controller, HttpCode, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import type { Member } from '../accounts/accounts.interfaces';
import { AuthGuard, CurrentMember } from '../auth/auth.guard';
import { parseOrThrow } from '../common/errors';
import { checkBarcode } from '../expiry/products.controller';
import { ProductSuggestionsService } from './product-suggestions.service';

const SuggestionBody = z.object({
  nameAr: z.string().trim().min(1).max(60),
  nameEn: z.string().trim().min(1).max(60).optional(),
});

@Controller('products')
@UseGuards(AuthGuard)
export class ProductSuggestionsController {
  constructor(@Inject(ProductSuggestionsService) private readonly suggestions: ProductSuggestionsService) {}

  /** US-2.03: the user's name for an unknown barcode, reviewed by the AI gateway. */
  @Post(':barcode/suggestion')
  @HttpCode(200)
  suggest(@CurrentMember() member: Member, @Param('barcode') barcode: string, @Body() body: unknown) {
    return this.suggestions.suggest(member, checkBarcode(barcode), parseOrThrow(SuggestionBody, body));
  }
}
