import { Inject, Injectable } from '@nestjs/common';
import { normaliseForMatch } from '../common/text';
import { PrismaService } from '../prisma/prisma.service';
import type { CatalogueCandidate, CatalogueEntry, FoodCategory, ICatalogueMatch, StoragePlace, Unit } from './expiry.interfaces';

interface CatalogueRow {
  id: string;
  name_ar: string;
  name_en: string;
  category: FoodCategory;
  unit: Unit;
  default_quantity: string;
  default_storage: StoragePlace;
  shelf_life_fridge: number | null;
  shelf_life_freezer: number | null;
  shelf_life_cupboard: number | null;
}

function toEntry(r: CatalogueRow): CatalogueEntry {
  const shelfLifeDays: CatalogueEntry['shelfLifeDays'] = {};
  if (r.shelf_life_fridge !== null) shelfLifeDays.fridge = r.shelf_life_fridge;
  if (r.shelf_life_freezer !== null) shelfLifeDays.freezer = r.shelf_life_freezer;
  if (r.shelf_life_cupboard !== null) shelfLifeDays.cupboard = r.shelf_life_cupboard;
  return {
    id: r.id,
    nameAr: r.name_ar,
    nameEn: r.name_en,
    category: r.category,
    unit: r.unit,
    defaultQuantity: Number(r.default_quantity),
    defaultStorage: r.default_storage,
    shelfLifeDays,
  };
}

const COLUMNS = `c.id, c.name_ar, c.name_en, c.category::text AS category, c.unit::text AS unit,
  c.default_quantity::text AS default_quantity, c.default_storage::text AS default_storage,
  c.shelf_life_fridge, c.shelf_life_freezer, c.shelf_life_cupboard`;

/** Owned by Expiry: the only code that reads expiry.food_catalogue_item. */
@Injectable()
export class CatalogueRepository implements ICatalogueMatch {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async closest(lines: string[], k: number): Promise<CatalogueCandidate[][]> {
    if (lines.length === 0) return [];
    // search_text holds every normalised name and alias separated by "|"; the score of an item is
    // the best word similarity between any of them and the line.
    const rows = await this.db.$queryRawUnsafe<(CatalogueRow & { idx: bigint; score: number })[]>(
      `SELECT l.idx, m.*
         FROM unnest($1::text[]) WITH ORDINALITY AS l(line, idx)
         CROSS JOIN LATERAL (
           SELECT ${COLUMNS},
                  max(extensions.word_similarity(t.term, l.line))::float8 AS score
             FROM expiry.food_catalogue_item c
             CROSS JOIN LATERAL unnest(string_to_array(c.search_text, '|')) AS t(term)
            WHERE c.retired_at IS NULL
            GROUP BY c.id
            ORDER BY score DESC, c.id
            LIMIT $2
         ) m
        ORDER BY l.idx, m.score DESC`,
      lines.map(normaliseForMatch),
      k,
    );
    const result: CatalogueCandidate[][] = lines.map(() => []);
    for (const row of rows) {
      result[Number(row.idx) - 1].push({ ...toEntry(row), score: row.score });
    }
    return result;
  }

  async byIds(ids: string[]): Promise<Map<string, CatalogueEntry>> {
    if (ids.length === 0) return new Map();
    const rows = await this.db.$queryRawUnsafe<CatalogueRow[]>(
      `SELECT ${COLUMNS} FROM expiry.food_catalogue_item c WHERE c.id = ANY($1::text[])`,
      ids,
    );
    return new Map(rows.map((r) => [r.id, toEntry(r)]));
  }
}
