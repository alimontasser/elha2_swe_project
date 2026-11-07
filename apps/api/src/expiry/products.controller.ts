import { Controller, Get, Inject, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AppError } from '../common/errors';
import { ProductsService } from './products.service';

/** EAN-8, UPC-A, EAN-13 and GTIN-14 are 8 to 14 digits. */
export function checkBarcode(barcode: string): string {
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
}
