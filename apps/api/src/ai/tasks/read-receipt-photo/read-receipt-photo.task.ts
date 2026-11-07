import { createHash } from 'node:crypto';
import { maskPersonalData } from '../../pii-masker';
import type { ImagePart } from '../../providers/provider';
import type { AiTask, PreparedPrompt } from '../../task-runner';
import { stripForeignScripts } from '../../text-cleanup';
import { PROMPT_VERSION, SYSTEM_PROMPT, USER_PROMPT } from './prompt.v1';
import { RECEIPT_TEXT_JSON_SCHEMA, type ReceiptText, ReceiptTextSchema } from './schema';

export interface ReceiptPhotoInput {
  photo: ImagePart;
}

export const MAX_LINES = 120;
export const MAX_LINE_CHARS = 120;

/**
 * US-2.01 from a photo: the model copies the receipt's lines. The photo goes to the model only;
 * it is never stored, cached or logged. Lines are masked here (US-14.03), before the runner
 * caches them, so names, phone and card numbers on the receipt are never kept.
 */
export class ReadReceiptPhotoTask implements AiTask<ReceiptPhotoInput, ReceiptText, null> {
  readonly name = 'readReceiptPhoto';
  readonly promptVersion = PROMPT_VERSION;
  readonly schema = ReceiptTextSchema;
  readonly jsonSchema = RECEIPT_TEXT_JSON_SCHEMA;

  sanitise(input: ReceiptPhotoInput) {
    return { input, maskedCount: 0 };
  }

  /** The photo's hash, so the same photo is not read twice and the photo itself is never kept. */
  canonical(input: ReceiptPhotoInput): string {
    return createHash('sha256').update(input.photo.base64).digest('hex');
  }

  prepare(input: ReceiptPhotoInput): Promise<PreparedPrompt<null>> {
    return Promise.resolve({ system: SYSTEM_PROMPT, user: USER_PROMPT, images: [input.photo], state: null });
  }

  check(output: ReceiptText): ReceiptText {
    const lines = output.lines
      .map((l) => stripForeignScripts(l).replace(/\s+/g, ' ').trim().slice(0, MAX_LINE_CHARS))
      .filter((l) => l.length > 0)
      .slice(0, MAX_LINES);
    return { lines: maskPersonalData(lines).lines };
  }

  recheck(output: ReceiptText): ReceiptText {
    return this.check(output);
  }

  /** Without a model that can see, the photo cannot be read; the app offers entry by hand (NFR-22). */
  fallback(): ReceiptText {
    return { lines: [] };
  }

  confidence(output: ReceiptText): number {
    return output.lines.length ? 0.8 : 0;
  }
}
