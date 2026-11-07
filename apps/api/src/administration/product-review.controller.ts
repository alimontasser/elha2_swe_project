import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AdminGuard } from '../auth/admin.guard';
import { AuthGuard } from '../auth/auth.guard';
import { AppError, parseOrThrow } from '../common/errors';
import { FOOD_CATEGORIES, type IProductCatalogue, PRODUCT_CATALOGUE, REVIEW_FILTERS, UNITS } from '../expiry/expiry.interfaces';
import { checkBarcode } from '../expiry/products.controller';

const DecisionBody = z.discriminatedUnion('decision', [
  z.object({
    decision: z.literal('accept'),
    nameAr: z.string().trim().min(1).max(60),
    nameEn: z.string().trim().min(1).max(60),
    category: z.enum(FOOD_CATEGORIES),
    catalogueId: z.string().max(80).nullable(),
    quantity: z.number().positive().max(10000).nullable(),
    unit: z.enum(UNITS).nullable(),
    note: z.string().trim().max(200).default(''),
  }),
  z.object({
    decision: z.literal('reject'),
    /** A reason is required, as for organisations (US-13.01). */
    note: z.string().trim().min(1).max(200),
  }),
]);

/** Administration: products users named for unknown barcodes, after the AI's review (US-2.03). */
@Controller('admin/products')
@UseGuards(AuthGuard, AdminGuard)
export class ProductReviewController {
  constructor(@Inject(PRODUCT_CATALOGUE) private readonly products: IProductCatalogue) {}

  @Get()
  async list(@Query('status') status = 'pending') {
    const filter = REVIEW_FILTERS.find((f) => f === status);
    if (!filter) throw new AppError(400, 'invalid_filter', `status is one of ${REVIEW_FILTERS.join(', ')}`);
    return { items: await this.products.listForReview(filter) };
  }

  /** Accept with corrected details, or reject with a reason. Overrules the AI's decision if there was one. */
  @Post(':barcode/decision')
  @HttpCode(200)
  async decide(@Param('barcode') barcode: string, @Body() body: unknown) {
    const d = parseOrThrow(DecisionBody, body);
    const done = await this.products.decide(
      checkBarcode(barcode),
      d.decision === 'accept'
        ? {
            status: 'known',
            reviewedBy: 'admin',
            note: d.note,
            nameAr: d.nameAr,
            nameEn: d.nameEn,
            category: d.category,
            catalogueId: d.catalogueId,
            quantity: d.quantity,
            unit: d.unit,
          }
        : { status: 'rejected', reviewedBy: 'admin', note: d.note },
    );
    if (!done) throw new AppError(404, 'product_not_found', 'No product named by a user has this barcode');
    return { barcode, status: d.decision === 'accept' ? 'known' : 'rejected' };
  }
}
