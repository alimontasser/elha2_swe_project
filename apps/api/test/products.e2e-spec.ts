import type { IProduct, ProductLookupResult } from '../src/adapters/product.interfaces';
import { CatalogueRepository } from '../src/expiry/catalogue.repository';
import { parseQuantity, ProductsService } from '../src/expiry/products.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import { newMember, testDb } from './helpers';

class FakeProducts implements IProduct {
  calls = 0;
  constructor(private readonly answer: ProductLookupResult) {}
  lookup(): Promise<ProductLookupResult> {
    this.calls++;
    return Promise.resolve(this.answer);
  }
}

let seq = 0;
/** A barcode no earlier run has stored. */
const freshBarcode = () => `9${Date.now().toString().slice(-10)}${(seq++).toString().padStart(2, '0')}`;

const juhayna: ProductLookupResult = {
  status: 'found',
  product: { nameEn: 'Full Cream Milk', nameAr: 'لبن كامل الدسم', brand: 'Juhayna', quantityText: '1 l', categories: ['dairies', 'milks'] },
};

describe('barcode lookup (US-2.03)', () => {
  let db: PrismaService;
  beforeAll(() => {
    db = testDb();
  });
  afterAll(() => db.$disconnect());
  const service = (external: IProduct) => new ProductsService(db, new CatalogueRepository(db), external);

  it('maps an Open Food Facts product to the catalogue, keeps it, and answers the next scan locally', async () => {
    const external = new FakeProducts(juhayna);
    const barcode = freshBarcode();
    const first = await service(external).lookup(barcode);
    expect(first).toMatchObject({
      found: true,
      nameAr: 'لبن كامل الدسم',
      nameEn: 'Full Cream Milk',
      brand: 'Juhayna',
      catalogueId: 'milk',
      category: 'dairy',
      quantity: 1,
      unit: 'l',
      storage: 'fridge',
    });
    const again = await service(external).lookup(barcode);
    expect(again).toEqual(first);
    expect(external.calls).toBe(1);
  });

  it('picks the head noun when a name holds two foods, with or without categories', async () => {
    const yogurt: ProductLookupResult = {
      status: 'found',
      product: { nameEn: 'Strawberry Yogurt', quantityText: '105 g', categories: [] },
    };
    expect(await service(new FakeProducts(yogurt)).lookup(freshBarcode())).toMatchObject({ catalogueId: 'yogurt' });
    const categorised: ProductLookupResult = {
      status: 'found',
      product: { nameEn: 'Juhayna Full Cream', categories: ['dairies', 'milks'] },
    };
    expect(await service(new FakeProducts(categorised)).lookup(freshBarcode())).toMatchObject({ catalogueId: 'milk' });
  });

  it('ignores untranslated category tags and pack sizes when matching', async () => {
    const spread: ProductLookupResult = {
      status: 'found',
      product: {
        nameEn: 'Nutella',
        quantityText: '400 g',
        categories: ['Breakfasts', 'Spreads', 'Cocoa powders', 'Pâtes à tartiner', 'fr:Nutella'],
      },
    };
    expect(await service(new FakeProducts(spread)).lookup(freshBarcode())).toMatchObject({ catalogueId: null, quantity: 400, unit: 'g' });
    const milk: ProductLookupResult = { status: 'found', product: { nameEn: 'Juhayna Milk 1L', categories: [] } };
    expect(await service(new FakeProducts(milk)).lookup(freshBarcode())).toMatchObject({ catalogueId: 'milk' });
  });

  it('keeps a product it cannot place without a catalogue item rather than guessing', async () => {
    const odd: ProductLookupResult = { status: 'found', product: { nameEn: 'Zqxv Blorp', quantityText: '250 g', categories: [] } };
    const view = await service(new FakeProducts(odd)).lookup(freshBarcode());
    expect(view).toMatchObject({ found: true, nameEn: 'Zqxv Blorp', catalogueId: null, quantity: 250, unit: 'g' });
  });

  it('reports an unknown barcode, and says when the lookup itself failed', async () => {
    expect(await service(new FakeProducts({ status: 'missing' })).lookup(freshBarcode())).toMatchObject({
      found: false,
      lookupFailed: false,
    });
    expect(await service(new FakeProducts({ status: 'failed' })).lookup(freshBarcode())).toMatchObject({
      found: false,
      lookupFailed: true,
    });
  });

  it('saves a user’s name for an unknown barcode for admin review, and never overwrites a known product', async () => {
    const me = await newMember(db);
    const unknown = freshBarcode();
    expect(await service(new FakeProducts({ status: 'missing' })).suggest(me, unknown, { nameAr: 'جبنة رومي' })).toEqual({ saved: true });
    const row = await db.product.findUnique({ where: { barcode: unknown } });
    expect(row).toMatchObject({ status: 'pendingReview', source: 'user', nameAr: 'جبنة رومي', suggestedBy: me.userId });
    // A pending suggestion is not shown as a known product.
    expect(await service(new FakeProducts({ status: 'missing' })).lookup(unknown)).toMatchObject({ found: false });

    const known = freshBarcode();
    await service(new FakeProducts(juhayna)).lookup(known);
    expect(await service(new FakeProducts(juhayna)).suggest(me, known, { nameAr: 'غلط' })).toEqual({ saved: false });
    expect((await db.product.findUnique({ where: { barcode: known } }))?.nameAr).toBe('لبن كامل الدسم');
  });

  it('reads sizes as printed on packs', () => {
    expect(parseQuantity('1 l')).toEqual({ quantity: 1, unit: 'l' });
    expect(parseQuantity('400 g')).toEqual({ quantity: 400, unit: 'g' });
    expect(parseQuantity('33 cl')).toEqual({ quantity: 330, unit: 'ml' });
    expect(parseQuantity('1,5L')).toEqual({ quantity: 1.5, unit: 'l' });
    expect(parseQuantity('6 x 125g')).toEqual({ quantity: 125, unit: 'g' });
    expect(parseQuantity('family size')).toBeNull();
  });
});
