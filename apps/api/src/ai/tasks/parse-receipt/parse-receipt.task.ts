import type { CatalogueCandidate, ICatalogueMatch } from '../../../expiry/expiry.interfaces';
import type { AiStore } from '../../ai.store';
import { maskPersonalData } from '../../pii-masker';
import type { AiTask, PreparedPrompt } from '../../task-runner';
import { PROMPT_VERSION, type PromptExample, renderUserPrompt, SYSTEM_PROMPT } from './prompt.v1';
import { ruleBasedParse } from './rule-based';
import { PARSE_RECEIPT_JSON_SCHEMA, type ParseReceiptOutput, ParseReceiptOutputSchema } from './schema';

export interface ParseReceiptInput {
  lines: string[];
  shopName?: string;
}

interface State {
  candidates: CatalogueCandidate[][];
}

export const MAX_LINES = 120;
export const MAX_LINE_CHARS = 120;
const CANDIDATES_PER_LINE = 5;
const MIN_CANDIDATE_SCORE = 0.25;
const EXAMPLES = 2;

/** US-2.01: turn masked receipt lines into pantry items with a confidence each. */
export class ParseReceiptTask implements AiTask<ParseReceiptInput, ParseReceiptOutput, State> {
  readonly name = 'parseReceipt';
  readonly promptVersion = PROMPT_VERSION;
  readonly schema = ParseReceiptOutputSchema;
  readonly jsonSchema = PARSE_RECEIPT_JSON_SCHEMA;

  constructor(
    private readonly catalogue: ICatalogueMatch,
    private readonly store: AiStore,
  ) {}

  sanitise(input: ParseReceiptInput) {
    const trimmed = input.lines
      .map((l) => l.replace(/\s+/g, ' ').trim().slice(0, MAX_LINE_CHARS))
      .filter((l) => l.length > 0)
      .slice(0, MAX_LINES);
    const masked = maskPersonalData(trimmed);
    const shopName = input.shopName ? maskPersonalData([input.shopName.slice(0, 60)]).lines[0] : undefined;
    return { input: { lines: masked.lines, shopName }, maskedCount: masked.maskedCount };
  }

  canonical(input: ParseReceiptInput): string {
    return JSON.stringify([input.shopName ?? '', input.lines]);
  }

  async prepare(input: ParseReceiptInput): Promise<PreparedPrompt<State>> {
    const candidates = await this.catalogue.closest(input.lines, CANDIDATES_PER_LINE);
    const examples = (await this.store.examples(this.name, EXAMPLES + 1))
      .map((e) => ({ lines: (e.input as { lines: string[] }).lines, answer: e.output }) as PromptExample)
      // Never show the model the receipt it is reading (matters when scoring the labelled set).
      .filter((e) => JSON.stringify(e.lines) !== JSON.stringify(input.lines))
      .slice(0, EXAMPLES);
    const lines = input.lines.map((text, index) => ({
      index,
      text,
      candidates: candidates[index]
        .filter((c) => c.score >= MIN_CANDIDATE_SCORE)
        .map((c) => ({ id: c.id, nameAr: c.nameAr, nameEn: c.nameEn, category: c.category, unit: c.unit })),
    }));
    return { system: SYSTEM_PROMPT, user: renderUserPrompt(lines, examples, input.shopName), state: { candidates } };
  }

  /** Drops items that point at a line that does not exist; keeps catalogue ids only from the offered candidates. */
  check(output: ParseReceiptOutput, input: ParseReceiptInput, state: State): ParseReceiptOutput {
    const items = output.items
      .filter((item) => item.line < input.lines.length)
      .map((item) => {
        if (!item.catalogueId) return item;
        const offered = state.candidates[item.line]?.some((c) => c.id === item.catalogueId && c.score >= MIN_CANDIDATE_SCORE);
        return offered ? item : { ...item, catalogueId: '', confidence: Math.min(item.confidence, 0.6) };
      });
    return { items };
  }

  fallback(input: ParseReceiptInput, state: State): ParseReceiptOutput {
    return { items: ruleBasedParse(input.lines, state.candidates) };
  }

  confidence(output: ParseReceiptOutput): number {
    if (output.items.length === 0) return 0;
    return output.items.reduce((sum, i) => sum + i.confidence, 0) / output.items.length;
  }
}
