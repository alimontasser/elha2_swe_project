import { Body, Controller, Get, HttpCode, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import type { Member } from '../accounts/accounts.interfaces';
import { AuthGuard, CurrentMember } from '../auth/auth.guard';
import { AppError, parseOrThrow } from '../common/errors';
import { UNITS } from './expiry.interfaces';
import { ProductsService } from './products.service';

const SuggestionBody = z.object({
  nameAr: z.string().trim().min(1).max(60),
  nameEn: z.string().trim().min(1).max(60).optional(),
  catalogueId: z.string().max(80).nullable().optional(),
  quantity: z.number().positive().max(10000).optional(),
  unit: z.enum(UNITS).optional(),
});

/** EAN-8, UPC-A, EAN-13 and GTIN-14 are 8 to 14 digits. */
function checkBarcode(barcode: string): string {
  if (!/^\d{8,14}$/.test(barcode)) throw new AppError(400, 'invalid_barcode', 'A barcode is 8 to 14 digits');
  return barcode;
}

@Controller('products')
@UseGuards(AuthGuard)
export class ProductsController {
  constructor(@Inject(ProductsService) private readonly products: ProductsService) {}

  /** US-2.03: a packaged item's details from its barcode. */
  @Get(':barcode')
  lookup(@Param('barcode') barcode: string) {
    return this.products.lookup(checkBarcode(barcode));
  }

  /** US-2.03: an unknown barcode, named by the user, saved for admin review. */
  @Post(':barcode/suggestion')
  @HttpCode(200)
  suggest(@CurrentMember() member: Member, @Param('barcode') barcode: string, @Body() body: unknown) {
    return this.products.suggest(member, checkBarcode(barcode), parseOrThrow(SuggestionBody, body));
  }
}
