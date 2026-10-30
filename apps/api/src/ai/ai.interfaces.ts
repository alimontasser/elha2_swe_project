import type { ParsedItem } from './tasks/parse-receipt/schema';

export interface ReceiptReading {
  /** The lines after server-side masking and trimming; item.line indexes into them. */
  lines: string[];
  items: ParsedItem[];
  confidence: number;
  /** True when no AI answer could be used and the rule-based reading was returned instead. */
  fallbackUsed: boolean;
  provider: string;
  promptVersion: number;
  requestId: string;
}

/**
 * Offered by the AI gateway to the feature modules (SDD §3.2.4). Each operation returns a result,
 * a confidence and whether the fallback was used. More tasks (voice, photos, recipes) join in later sprints.
 */
export interface IAI {
  parseReceipt(lines: string[], ctx: { userId: string; shopName?: string }): Promise<ReceiptReading>;
  /** The person changed the AI's answer before saving it (feeds US-14.04). */
  recordCorrection(requestId: string): Promise<void>;
}

export const AI = Symbol('IAI');
export const AI_PROVIDERS = Symbol('AI_PROVIDERS');
export const AI_STORE = Symbol('AI_STORE');
