import { randomUUID } from 'node:crypto';
import { AppError } from '../src/common/errors';
import type { CreatePantryItem } from '../src/pantry/items.schemas';
import { HISTORY_DAYS, PantryItemsService } from '../src/pantry/items.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import { newMember, testDb } from './helpers';

const item = (over: Partial<CreatePantryItem> = {}): CreatePantryItem => ({
  id: randomUUID(),
  catalogueId: 'milk',
  nameAr: 'لبن',
  nameEn: 'Milk',
  category: 'dairy',
  quantity: 1,
  unit: 'l',
  storage: 'fridge',
  expiryDate: '2026-11-12',
  expirySource: 'estimated',
  addedBy: 'manual',
  status: 'inStock',
  wasteReason: null,
  wasteNote: null,
  ...over,
});

describe('pantry items (US-2.07, 2.10, 2.11)', () => {
  let db: PrismaService;
  let service: PantryItemsService;

  beforeAll(() => {
    db = testDb();
    service = new PantryItemsService(db);
  });
  afterAll(() => db.$disconnect());

  it('lists only the household’s items, soonest expiry first', async () => {
    const me = await newMember(db);
    const other = await newMember(db);
    await service.create(me, item({ nameEn: 'Later', expiryDate: '2026-11-20' }));
    await service.create(me, item({ nameEn: 'Sooner', expiryDate: '2026-11-08' }));
    await service.create(other, item({ nameEn: 'Not mine' }));
    expect((await service.list(me)).map((i) => i.nameEn)).toEqual(['Sooner', 'Later']);
  });

  it('creating the same id twice keeps one item, and another household cannot reuse it', async () => {
    const me = await newMember(db);
    const body = item();
    const first = await service.create(me, body);
    const again = await service.create(me, { ...body, nameEn: 'Changed' });
    expect(again).toEqual(first);
    expect(await service.list(me)).toHaveLength(1);
    await expect(service.create(await newMember(db), body)).rejects.toMatchObject({ status: 409 });
  });

  it('records waste with a reason and note, and clears them when the item is back in stock', async () => {
    const me = await newMember(db);
    const created = await service.create(me, item());
    const wasted = await service.update(me, created.id, { status: 'wasted', wasteReason: 'other', wasteNote: 'نسيته برة التلاجة' });
    expect(wasted).toMatchObject({ status: 'wasted', wasteReason: 'other', wasteNote: 'نسيته برة التلاجة' });
    const back = await service.update(me, created.id, { status: 'inStock' });
    expect(back).toMatchObject({ status: 'inStock', wasteReason: null, wasteNote: null });
  });

  it('edits quantity, storage and a user-set expiry date', async () => {
    const me = await newMember(db);
    const created = await service.create(me, item());
    const edited = await service.update(me, created.id, {
      quantity: 0.5,
      storage: 'freezer',
      expiryDate: '2027-01-15',
      expirySource: 'userSet',
    });
    expect(edited).toMatchObject({ quantity: 0.5, storage: 'freezer', expiryDate: '2027-01-15', expirySource: 'userSet' });
  });

  it('another household can neither change nor delete my item', async () => {
    const me = await newMember(db);
    const stranger = await newMember(db);
    const created = await service.create(me, item());
    await expect(service.update(stranger, created.id, { quantity: 9 })).rejects.toBeInstanceOf(AppError);
    await service.remove(stranger, created.id);
    expect(await service.list(me)).toHaveLength(1);
  });

  it('Undo deletes the item, and deleting it again is not an error', async () => {
    const me = await newMember(db);
    const created = await service.create(me, item());
    await service.remove(me, created.id);
    await service.remove(me, created.id);
    expect(await service.list(me)).toHaveLength(0);
  });

  it(`keeps used and wasted items listed for ${HISTORY_DAYS} days only`, async () => {
    const me = await newMember(db);
    const created = await service.create(me, item());
    await service.update(me, created.id, { status: 'used' });
    expect(await service.list(me)).toHaveLength(1);
    const later = new Date(Date.now() + (HISTORY_DAYS + 1) * 86_400_000);
    expect(await service.list(me, later)).toHaveLength(0);
  });
});
