import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { Member } from '../accounts/accounts.interfaces';
import { AI, type IAI } from '../ai/ai.interfaces';
import { AppError } from '../common/errors';
import { cairoDate } from '../common/text';
import { CATALOGUE_MATCH, ESTIMATE_EXPIRY, type ICatalogueMatch, type IEstimateExpiry } from '../expiry/expiry.interfaces';
import { CATEGORY_DEFAULT_STORAGE } from '../expiry/expiry.rules';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { ConfirmReceiptRequest, DraftItem, ScanReceiptRequest } from './receipts.schemas';

export const DRAFT_LIFETIME_MS = 24 * 60 * 60 * 1000;

export interface DraftView {
  id: string;
  items: DraftItem[];
  /** The masked lines, so the app can offer manual entry when the AI could not help. */
  lines: string[];
  fallbackUsed: boolean;
  confidence: number;
  expiresAt: string;
}

/** Pantry module: scan a receipt into a draft, then confirm it into pantry items (US-2.01, US-2.02). */
@Injectable()
export class ReceiptsService {
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(AI) private readonly ai: IAI,
    @Inject(CATALOGUE_MATCH) private readonly catalogue: ICatalogueMatch,
    @Inject(ESTIMATE_EXPIRY) private readonly expiry: IEstimateExpiry,
  ) {}

  async scan(member: Member, request: ScanReceiptRequest, now = new Date()): Promise<DraftView> {
    const reading = await this.ai.parseReceipt(request.lines, { userId: member.userId, shopName: request.shopName });
    const purchasedOn = cairoDate(now);
    const entries = await this.catalogue.byIds(reading.items.map((i) => i.catalogueId).filter(Boolean));

    const items: DraftItem[] = [];
    for (const item of reading.items) {
      const catalogueId = item.catalogueId && entries.has(item.catalogueId) ? item.catalogueId : null;
      const storage = catalogueId ? entries.get(catalogueId)!.defaultStorage : CATEGORY_DEFAULT_STORAGE[item.category];
      const expiry = await this.expiry.estimate({ catalogueId, category: item.category }, storage, purchasedOn);
      items.push({
        id: randomUUID(),
        sourceLine: reading.lines[item.line] ?? '',
        catalogueId,
        nameAr: item.nameAr,
        nameEn: item.nameEn,
        quantity: item.quantity,
        unit: item.unit,
        category: item.category,
        storage,
        expiryDate: expiry.date,
        expirySource: expiry.source,
        confidence: Math.round(item.confidence * 100) / 100,
      });
    }

    const draft = await this.db.receiptDraft.create({
      data: {
        householdId: member.householdId,
        userId: member.userId,
        lines: reading.lines,
        items: items as unknown as Prisma.InputJsonValue,
        aiRequestId: reading.requestId,
        fallbackUsed: reading.fallbackUsed,
        createdAt: now,
      },
    });
    return {
      id: draft.id,
      items,
      lines: reading.lines,
      fallbackUsed: reading.fallbackUsed,
      confidence: Math.round(reading.confidence * 100) / 100,
      expiresAt: new Date(now.getTime() + DRAFT_LIFETIME_MS).toISOString(),
    };
  }

  /** Saves every reviewed item in one transaction and deletes the draft. Nothing is saved before this (NFR-30). */
  async confirm(member: Member, draftId: string, request: ConfirmReceiptRequest, now = new Date()) {
    const draft = await this.db.receiptDraft.findUnique({ where: { id: draftId } });
    if (!draft || draft.householdId !== member.householdId) throw new AppError(404, 'draft_not_found', 'This receipt draft does not exist');
    if (now.getTime() - draft.createdAt.getTime() > DRAFT_LIFETIME_MS) {
      throw new AppError(410, 'draft_expired', 'This receipt draft is older than 24 hours; scan the receipt again');
    }

    const original = new Map((draft.items as unknown as DraftItem[]).map((i) => [i.id, i]));
    const corrected =
      request.items.length !== original.size ||
      request.items.some((item) => {
        const before = original.get(item.id);
        return (
          !before ||
          before.nameAr !== item.nameAr ||
          before.nameEn !== item.nameEn ||
          before.quantity !== item.quantity ||
          before.unit !== item.unit ||
          before.category !== item.category
        );
      });

    const created = await this.db.$transaction(async (tx) => {
      const rows = await Promise.all(
        request.items.map((item) => {
          const before = original.get(item.id);
          return tx.pantryItem.create({
            data: {
              householdId: member.householdId,
              catalogueId: item.catalogueId,
              nameAr: item.nameAr,
              nameEn: item.nameEn,
              category: item.category,
              quantity: new Prisma.Decimal(item.quantity),
              unit: item.unit,
              storage: item.storage,
              expiryDate: new Date(`${item.expiryDate}T00:00:00Z`),
              expirySource: before && before.expiryDate === item.expiryDate ? 'estimated' : 'userSet',
              addedBy: 'receipt',
              addedOn: now,
            },
          });
        }),
      );
      await tx.receiptDraft.delete({ where: { id: draft.id } });
      return rows;
    });

    if (corrected && draft.aiRequestId) await this.ai.recordCorrection(draft.aiRequestId);
    return {
      added: created.length,
      items: created.map((r) => ({
        id: r.id,
        nameAr: r.nameAr,
        nameEn: r.nameEn,
        quantity: Number(r.quantity),
        unit: r.unit,
        storage: r.storage,
        expiryDate: r.expiryDate.toISOString().slice(0, 10),
      })),
    };
  }

  /** Deletes drafts older than 24 hours (data dictionary: ReceiptDraft). Called by the Scheduler. */
  async purgeExpiredDrafts(now = new Date()): Promise<number> {
    const { count } = await this.db.receiptDraft.deleteMany({
      where: { createdAt: { lt: new Date(now.getTime() - DRAFT_LIFETIME_MS) } },
    });
    return count;
  }
}
