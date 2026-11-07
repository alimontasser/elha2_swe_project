// US-14.03, server side. The phone masks receipt text before upload (apps/mobile/lib/core/pii_masker.dart);
// the AI gateway runs the same rules again before any provider call (SDD Fig. 3.5, step 4).
// Both implementations are tested against fixtures/pii_cases.json, so they cannot drift apart.

export interface MaskResult {
  lines: string[];
  maskedCount: number;
}

export const NAME_TOKEN = '[name]';
export const PHONE_TOKEN = '[phone]';
export const CARD_TOKEN = '[card]';
export const EMAIL_TOKEN = '[email]';

const ARABIC_DIGITS = /[٠-٩]/g;

// Labels after which a person's name follows, in Arabic and English.
const NAME_LABEL =
  /(?<!\[)((?:customer|client|cashier|name|member|delivered to|اسم العميل|العميل|الكاشير|كاشير|الاسم|اسم|السيد|السيدة|عضو)\s*[:：-]?\s*)([^\d:：\n]{1,40}?)\s*$/i;

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;

// Card numbers: 13-19 digits, possibly grouped, or masked forms like **** 1234 / XXXX-XXXX-XXXX-1234.
const CARD = /(?:(?:\d|[*xX]){4}[ -]?){3}(?:\d|[*xX]){1,7}/g;
const CARD_TAIL = /((?:card|visa|mastercard|meeza|بطاقة|كارت|فيزا)[^\d\n]{0,12})(\d{4})\b/gi;

// Egyptian mobiles (01x xxxx xxxx, +20 / 0020) and Cairo or governorate landlines.
const PHONE = /(?<!\d)(?:(?:\+|00)20[\s-]?|0)(?:1[0125](?:[\s-]?\d){8}|2(?:[\s-]?\d){8}|[3-9]\d(?:[\s-]?\d){7})(?!\d)/g;

function luhn(digits: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export function maskPersonalData(lines: string[]): MaskResult {
  let count = 0;
  const out = lines.map((raw) => {
    let line = raw.replace(ARABIC_DIGITS, (d) => String(d.charCodeAt(0) - 0x0660));
    line = line.replace(EMAIL, () => {
      count++;
      return EMAIL_TOKEN;
    });
    line = line.replace(CARD, (match) => {
      const digits = match.replace(/[^\d*xX]/g, '');
      const isMasked = /[*xX]/.test(digits);
      // Pure digit runs must pass the Luhn check, so product barcodes (EAN-13) are usually kept.
      if (digits.length < 13 || (!isMasked && !luhn(digits))) return match;
      count++;
      return CARD_TOKEN;
    });
    line = line.replace(CARD_TAIL, (_match, label: string) => {
      count++;
      return `${label}${CARD_TOKEN}`;
    });
    line = line.replace(PHONE, () => {
      count++;
      return PHONE_TOKEN;
    });
    line = line.replace(NAME_LABEL, (match, label: string, value: string) => {
      const v = value.trim();
      if (!v || v.startsWith('[')) return match;
      count++;
      return `${label}${NAME_TOKEN}`;
    });
    return line;
  });
  return { lines: out, maskedCount: count };
}
