import { Inject, Injectable } from '@nestjs/common';
import type { Member } from '../accounts/accounts.interfaces';
import { AppError } from '../common/errors';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreatePantryItem, UpdatePantryItem } from './items.schemas';

/** Used, donated and wasted items stay listed this long, for the waste rate and Undo. */
export const HISTORY_DAYS = 90;

type Row = Prisma.PantryItemGetPayload<object>;

const dateOnly = (d: Date) => d.toISOString().slice(0, 10);
const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);

export function toView(r: Row) {
  return {
    id: r.id,
    catalogueId: r.catalogueId,
    nameAr: r.nameAr,
    nameEn: r.nameEn,
    category: r.category,
    quantity: Number(r.quantity),
    unit: r.unit,
    storage: r.storage,
    expiryDate: dateOnly(r.expiryDate),
    expirySource: r.expirySource,
    status: r.status,
    wasteReason: r.wasteReason,
    wasteNote: r.wasteNote,
    addedBy: r.addedBy,
    addedOn: r.addedOn.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export type PantryItemView = ReturnType<typeof toView>;

/** Pantry module: the household's items (US-2.07, 2.10, 2.11). Every query is scoped to the household. */
@Injectable()
export class PantryItemsService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async list(member: Member, now = new Date()): Promise<PantryItemView[]> {
    const since = new Date(now.getTime() - HISTORY_DAYS * 86_400_000);
    const rows = await this.db.pantryItem.findMany({
      where: { householdId: member.householdId, OR: [{ status: 'inStock' }, { updatedAt: { gte: since } }] },
      orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
      take: 1000,
    });
    return rows.map(toView);
  }

  /** Posting the same id again returns the item as it is, so the app can retry safely. */
  async create(member: Member, item: CreatePantryItem, now = new Date()): Promise<PantryItemView> {
    const existing = await this.db.pantryItem.findUnique({ where: { id: item.id } });
    if (existing) {
      if (existing.householdId !== member.householdId) throw new AppError(409, 'id_taken', 'This item id is already used');
      return toView(existing);
    }
    const row = await this.db.pantryItem.create({
      data: {
        id: item.id,
        householdId: member.householdId,
        catalogueId: item.catalogueId,
        nameAr: item.nameAr,
        nameEn: item.nameEn,
        category: item.category,
        quantity: new Prisma.Decimal(item.quantity),
        unit: item.unit,
        storage: item.storage,
        expiryDate: toDate(item.expiryDate),
        expirySource: item.expirySource,
        status: item.status,
        wasteReason: item.wasteReason,
        wasteNote: item.wasteNote,
        addedBy: item.addedBy,
        addedOn: now,
      },
    });
    return toView(row);
  }

  async update(member: Member, id: string, change: UpdatePantryItem): Promise<PantryItemView> {
    const existing = await this.db.pantryItem.findFirst({ where: { id, householdId: member.householdId } });
    if (!existing) throw new AppError(404, 'item_not_found', 'This pantry item does not exist');
    const row = await this.db.pantryItem.update({
      where: { id },
      data: {
        ...change,
        quantity: change.quantity === undefined ? undefined : new Prisma.Decimal(change.quantity),
        expiryDate: change.expiryDate === undefined ? undefined : toDate(change.expiryDate),
        // Back in stock: a stale waste reason would wrongly count as waste.
        ...(change.status === 'inStock' ? { wasteReason: null, wasteNote: null } : {}),
      },
    });
    return toView(row);
  }

  /** Undo of an add. Deleting an item that is already gone is not an error, so retries are safe. */
  async remove(member: Member, id: string): Promise<void> {
    await this.db.pantryItem.deleteMany({ where: { id, householdId: member.householdId } });
  }
}
