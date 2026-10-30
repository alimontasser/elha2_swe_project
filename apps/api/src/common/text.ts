const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';

/** Arabic-Indic digits (٠-٩) to ASCII, so numbers parse the same in both scripts. */
export function toAsciiDigits(s: string): string {
  return s.replace(/[٠-٩]/g, (d) => String(ARABIC_INDIC.indexOf(d)));
}

/** Folds common Arabic spelling variants (أ/إ/آ → ا, ة → ه, ى → ي) and drops diacritics; lower-cases Latin. */
export function normaliseForMatch(s: string): string {
  return toAsciiDigits(s)
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[ً-ْ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Today's date in Cairo as YYYY-MM-DD (NFR-31: times in Africa/Cairo). */
export function cairoDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(now);
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
