import { toAsciiDigits } from '../../../common/text';
import type { CatalogueCandidate, Unit } from '../../../expiry/expiry.interfaces';
import type { ParsedItem } from './schema';

// Lines that are never food: totals, payment, people, the shop itself.
const NOT_FOOD =
  /\[(name|phone|card|email)\]|total|subtotal|vat|tax|cash|change|visa|master|card|invoice|receipt|cashier|member|tel\b|bag|الإجمالي|الاجمالي|المجموع|اجمالي|ضريبة|خصم|نقدي|نقدا|الباقي|فاتورة|فيزا|كارت|بطاقة|كاشير|العميل|موبايل|تليفون/i;

const NUMBER = String.raw`(\d+(?:[.,]\d+)?)`;
const END = String.raw`(?=[\s)]|$)`;
const MEASURES: { re: RegExp; unit: Unit; factor: number }[] = [
  { re: new RegExp(`${NUMBER}\\s*(?:kg|كجم|كيلو|ك)${END}`, 'i'), unit: 'kg', factor: 1 },
  { re: new RegExp(`${NUMBER}\\s*(?:g|gm|gr|جم|جرام)${END}`, 'i'), unit: 'kg', factor: 0.001 },
  { re: new RegExp(`${NUMBER}\\s*(?:l|ltr|لتر)${END}`, 'i'), unit: 'l', factor: 1 },
  { re: new RegExp(`${NUMBER}\\s*(?:ml|مل)${END}`, 'i'), unit: 'l', factor: 0.001 },
  { re: new RegExp(`${NUMBER}\\s*(?:pc|pcs|pk|قطعة|قطع)${END}`, 'i'), unit: 'piece', factor: 1 },
  { re: new RegExp(`${NUMBER}\\s*(?:علبة|علب|كيس|pack)${END}`, 'i'), unit: 'pack', factor: 1 },
];
const COUNT_UNITS: ReadonlySet<Unit> = new Set<Unit>(['loaf', 'pack', 'piece']);
const MULTIPLIER = /(?:^|\s)[x×]\s*(\d+)(?=\s|$)/i;
const COUNT_TIMES_PRICE = /(?:^|\s)(\d+)\s*[x×]\s*\d/i;

function toNumber(s: string): number {
  return Number(s.replace(',', '.'));
}

/** Reads a quantity and unit from a receipt line, or returns null when it cannot tell. */
export function readQuantity(rawLine: string): { quantity: number; unit: Unit } | null {
  const line = toAsciiDigits(rawLine);
  const multiplier = MULTIPLIER.exec(line);
  const times = multiplier ? Number(multiplier[1]) : 1;
  for (const m of MEASURES) {
    const hit = m.re.exec(line);
    if (hit) {
      const value = toNumber(hit[1]) * m.factor * times;
      if (value > 0) return { quantity: Math.round(value * 1000) / 1000, unit: m.unit };
    }
  }
  const count = COUNT_TIMES_PRICE.exec(line);
  if (count) return { quantity: Number(count[1]), unit: 'piece' };
  if (multiplier) return { quantity: times, unit: 'piece' };
  return null;
}

/**
 * The non-AI path for receipts (NFR-22, US-14.01 "rule-based result"): the best catalogue match per
 * line and a regex quantity. Confidence never exceeds 0.5, so every item shows orange for review.
 */
export function ruleBasedParse(lines: string[], candidates: CatalogueCandidate[][], minScore = 0.45): ParsedItem[] {
  const items: ParsedItem[] = [];
  lines.forEach((line, index) => {
    if (NOT_FOOD.test(line) || !/\p{L}/u.test(line)) return;
    const best = candidates[index]?.[0];
    if (!best || best.score < minScore) return;
    const read = readQuantity(line);
    let quantity = best.defaultQuantity;
    let unit: Unit = best.unit;
    if (read) {
      // "10 × 1.25" on a bread line is 10 loaves: a count keeps the catalogue's counting unit.
      quantity = read.quantity;
      unit = COUNT_UNITS.has(read.unit) && COUNT_UNITS.has(best.unit) ? best.unit : read.unit;
    }
    items.push({
      line: index,
      catalogueId: best.id,
      nameAr: best.nameAr,
      nameEn: best.nameEn,
      quantity,
      unit,
      category: best.category,
      confidence: Math.min(0.5, Math.round((0.2 + 0.3 * best.score) * 100) / 100),
    });
  });
  return items;
}
