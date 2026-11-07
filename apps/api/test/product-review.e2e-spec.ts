import type { IAI, ProductReviewOutcome } from '../src/ai/ai.interfaces';
import { CatalogueRepository } from '../src/expiry/catalogue.repository';
import type { IProduct } from '../src/adapters/product.interfaces';
import { ProductsService } from '../src/expiry/products.service';
import { ProductSuggestionsService } from '../src/pantry/product-suggestions.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import { newMember, testDb } from './helpers';

const offline: IProduct = { lookup: () => Promise.resolve({ status: 'missing' }) };

function aiSays(review: Partial<ProductReviewOutcome>): IAI & { calls: number } {
  const ai = {
    calls: 0,
    reviewProduct() {
      ai.calls++;
      return Promise.resolve({
        decision: 'accept',
        reason: 'ok',
        nameAr: '',
        nameEn: '',
        category: 'dry',
        catalogueId: null,
        quantity: null,
        unit: null,
        confidence: 0.9,
        fallbackUsed: false,
        requestId: 'r1',
        ...review,
      });
    },
  };
  return ai as unknown as IAI & { calls: number };
}

let seq = 0;
const freshBarcode = () => `622${Date.now().toString().slice(-8)}${(seq++).toString().padStart(2, '0')}`;

describe('AI review of unknown barcodes (US-2.03)', () => {
  let db: PrismaService;
  let products: ProductsService;
  beforeAll(() => {
    db = testDb();
    products = new ProductsService(db, new CatalogueRepository(db), offline);
  });
  afterAll(() => db.$disconnect());

  it('an accepted name becomes a known product that the next scan finds, with the AI’s details', async () => {
    const me = await newMember(db);
    const barcode = freshBarcode();
    const ai = aiSays({
      nameAr: 'جبنة رومي دومتي',
      nameEn: 'Domty Roumi Cheese',
      category: 'dairy',
      catalogueId: 'roumi-cheese',
      quantity: 250,
      unit: 'g',
      reason: 'real dairy product',
    });
    const result = await new ProductSuggestionsService(products, ai).suggest(me, barcode, { nameAr: 'جبنه رومي دومتي ٢٥٠ جم' });
    expect(result).toEqual({ saved: true, status: 'known' });
    const row = await db.product.findUnique({ where: { barcode } });
    expect(row).toMatchObject({ status: 'known', reviewedBy: 'ai', reviewNote: 'real dairy product', suggestedBy: me.userId });
    expect(await products.lookup(barcode)).toMatchObject({
      found: true,
      nameAr: 'جبنة رومي دومتي',
      nameEn: 'Domty Roumi Cheese',
      category: 'dairy',
      quantity: 250,
      unit: 'g',
    });
  });

  it('a rejected name is kept out, and the barcode stays unknown', async () => {
    const barcode = freshBarcode();
    const result = await new ProductSuggestionsService(products, aiSays({ decision: 'reject', reason: 'not a food' })).suggest(
      await newMember(db),
      barcode,
      { nameAr: 'شاحن موبايل' },
    );
    expect(result.status).toBe('rejected');
    expect(await db.product.findUnique({ where: { barcode } })).toMatchObject({
      status: 'rejected',
      nameAr: null,
      reviewNote: 'not a food',
    });
    expect(await products.lookup(barcode)).toMatchObject({ found: false });
  });

  it('masks personal details before the suggestion is stored, even while it waits for an admin', async () => {
    const barcode = freshBarcode();
    await new ProductSuggestionsService(products, aiSays({ decision: 'unsure', confidence: 0, fallbackUsed: true })).suggest(
      await newMember(db),
      barcode,
      {
        nameAr: 'جبنة من عند محمد 01012345678',
      },
    );
    expect((await db.product.findUnique({ where: { barcode } }))?.nameAr).not.toContain('01012345678');
  });

  it('when the AI is unsure or unavailable, the suggestion waits for an admin with the AI’s note', async () => {
    const unsure = freshBarcode();
    await new ProductSuggestionsService(products, aiSays({ decision: 'accept', confidence: 0.4, reason: 'brand unclear' })).suggest(
      await newMember(db),
      unsure,
      { nameAr: 'حاجة حلوة' },
    );
    expect(await db.product.findUnique({ where: { barcode: unsure } })).toMatchObject({
      status: 'pendingReview',
      reviewedBy: null,
      reviewNote: 'AI unsure: brand unclear',
    });

    const down = freshBarcode();
    await new ProductSuggestionsService(
      products,
      aiSays({ decision: 'unsure', confidence: 0, fallbackUsed: true, reason: 'AI unavailable' }),
    ).suggest(await newMember(db), down, { nameAr: 'بسكوت' });
    expect((await db.product.findUnique({ where: { barcode: down } }))?.status).toBe('pendingReview');
  });

  it('a known product is never renamed by a suggestion, and the AI is not asked', async () => {
    const barcode = freshBarcode();
    await new ProductSuggestionsService(products, aiSays({ nameAr: 'لبن', nameEn: 'Milk', category: 'dairy' })).suggest(
      await newMember(db),
      barcode,
      { nameAr: 'لبن' },
    );
    const ai = aiSays({ nameAr: 'غلط', nameEn: 'Wrong' });
    expect(await new ProductSuggestionsService(products, ai).suggest(await newMember(db), barcode, { nameAr: 'غلط' })).toEqual({
      saved: false,
      status: 'known',
    });
    expect(ai.calls).toBe(0);
    expect((await db.product.findUnique({ where: { barcode } }))?.nameAr).toBe('لبن');
  });
});
