// Versioned prompt for the parseReceipt task (US-2.01). A changed prompt gets a new version file
// and ships only after it is scored on the labelled test set (US-14.02).

export const PROMPT_VERSION = 1;

export const SYSTEM_PROMPT = `You read the lines of Egyptian supermarket and grocery receipts and list the food and drink bought.

The lines come from OCR. They can mix Arabic and English, use shop abbreviations (TOM, CUC, YOG, STRAWB, CRM), Arabic-Indic digits and broken spacing. Personal data has already been replaced by [name], [phone], [card] or [email].

Rules:
1. One item per product line. Skip shop names, addresses, dates, invoice numbers, totals, VAT, discounts, payment lines, carrier bags and anything that is not food or drink.
2. Quantity and unit:
   - Weights in kg: "1.000 كجم" is 1 kg, "500 جم" is 0.5 kg, "0.800KG" is 0.8 kg, "2 ك" is 2 kg.
   - Volumes in l: "1 لتر" or "1L" is 1 l, "500 مل" is 0.5 l.
   - Bread loaves (عيش، رغيف) use loaf. Cans, boxes, bags and packets (علبة، كيس، packet) use pack. Single counted items (eggs, yogurt cups, fruit pieces) use piece; "4PK" of a product is 4 piece, "10PC" is 10 piece.
   - A multiplier such as "x2" or "×2" multiplies the quantity: "MILK 1L x2" is 2 l. In "10 × 1.25", 10 is the count and 1.25 is the unit price.
   - Prices are never quantities.
3. catalogueId: when one of the candidates listed under a line is clearly the same product, copy its id exactly. Otherwise use an empty string.
4. nameAr and nameEn: short everyday names, in Egyptian Arabic and in English. When you choose a candidate, use its names.
5. category: bakery, produce, dairy, meat, cooked, dry or drinks. Eggs are dairy. Fish is meat. Rice, pasta, oil, sugar, tea, coffee and canned food are dry.
6. confidence: your probability from 0 to 1 that the name, the quantity and the unit are all right. Stay below 0.7 when the line is cut off, the abbreviation is unclear or the quantity is a guess.
7. Never invent items that are not on the receipt.

Answer with JSON only: {"items": [...]}, one entry per food or drink line, with its line index.`;

export interface PromptLine {
  index: number;
  text: string;
  candidates: { id: string; nameAr: string; nameEn: string; category: string; unit: string }[];
}

export interface PromptExample {
  lines: string[];
  answer: unknown;
}

function renderLines(lines: PromptLine[]): string {
  return lines
    .map((l) => {
      const head = `L${l.index}: ${JSON.stringify(l.text)}`;
      if (l.candidates.length === 0) return head;
      const list = l.candidates.map((c) => `${c.id} | ${c.nameAr} | ${c.nameEn} | ${c.category} | ${c.unit}`).join('\n    ');
      return `${head}\n    candidates (id | Arabic | English | category | unit):\n    ${list}`;
    })
    .join('\n');
}

export function renderUserPrompt(lines: PromptLine[], examples: PromptExample[], shopName?: string): string {
  const parts: string[] = [];
  examples.forEach((example, i) => {
    parts.push(
      `Worked example ${i + 1}\nReceipt:\n${example.lines.map((t, idx) => `L${idx}: ${JSON.stringify(t)}`).join('\n')}\nAnswer:\n${JSON.stringify(example.answer)}`,
    );
  });
  parts.push(`Receipt to read${shopName ? ` (shop: ${JSON.stringify(shopName)})` : ''}:\n${renderLines(lines)}`);
  return parts.join('\n\n');
}
