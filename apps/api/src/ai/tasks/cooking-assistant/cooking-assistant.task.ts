import { maskPersonalData } from '../../pii-masker';
import type { AiTask, PreparedPrompt } from '../../task-runner';
import { PROMPT_VERSION, type PromptContext, renderUserPrompt, SYSTEM_PROMPT } from './prompt.v1';
import { isMedical, isUnsafe, type Lang, mentionsLeftovers, stripForeignScripts, TEXT } from './safety';
import { COOKING_ANSWER_JSON_SCHEMA, type CookingAnswer, CookingAnswerSchema } from './schema';

export type CookingAssistantInput = PromptContext;

export const MAX_QUESTION_CHARS = 500;
export const MAX_ITEMS = 20;
const FALLBACK_ITEMS = 3;

/** The language to answer in: the question's script, else the app's language. */
export function answerLanguage(question: string, appLanguage: Lang): Lang {
  if (/[؀-ۿ]/.test(question)) return 'ar';
  if (/[A-Za-z]/.test(question)) return 'en';
  return appLanguage;
}

/** US-4.02: answer a cooking question from the household's pantry, safely (NFR-07). */
export class CookingAssistantTask implements AiTask<CookingAssistantInput, CookingAnswer, null> {
  readonly name = 'cookingAssistant';
  readonly promptVersion = PROMPT_VERSION;
  readonly schema = CookingAnswerSchema;
  readonly jsonSchema = COOKING_ANSWER_JSON_SCHEMA;

  sanitise(input: CookingAssistantInput) {
    const question = input.question.replace(/\s+/g, ' ').trim().slice(0, MAX_QUESTION_CHARS);
    const items = [...input.items].sort((a, b) => a.daysLeft - b.daysLeft).slice(0, MAX_ITEMS);
    const masked = maskPersonalData([question, ...items.map((i) => i.name.trim().slice(0, 60))]);
    const [maskedQuestion, ...names] = masked.lines;
    return {
      input: {
        ...input,
        question: maskedQuestion,
        language: answerLanguage(maskedQuestion, input.language),
        items: items.map((i, k) => ({ name: names[k], daysLeft: i.daysLeft, cooked: i.cooked || undefined })),
      },
      maskedCount: masked.maskedCount,
    };
  }

  canonical(input: CookingAssistantInput): string {
    return JSON.stringify([input.question, input.language, input.items, input.householdSize ?? 0, input.allergies ?? [], input.diet ?? '']);
  }

  prepare(input: CookingAssistantInput): Promise<PreparedPrompt<null>> {
    return Promise.resolve({ system: SYSTEM_PROMPT, user: renderUserPrompt(input), state: null });
  }

  private leftoversInvolved(input: CookingAssistantInput, answer: string): boolean {
    return input.items.some((i) => i.cooked) || mentionsLeftovers(input.question) || mentionsLeftovers(answer);
  }

  /** NFR-07 backstop: fixed texts replace off-topic, medical or unsafe answers; leftovers always get a reheating note. */
  check(raw: CookingAnswer, input: CookingAssistantInput): CookingAnswer {
    const text = TEXT[input.language];
    const output = { ...raw, answer: stripForeignScripts(raw.answer), reheatingNote: stripForeignScripts(raw.reheatingNote) };
    if (!output.onTopic || isMedical(output.answer)) {
      return { onTopic: false, answer: text.decline, reheatingNote: '', usedItems: [] };
    }
    if (isUnsafe(`${output.answer} ${output.reheatingNote}`)) {
      return { onTopic: true, answer: text.unsafe, reheatingNote: text.reheating, usedItems: [] };
    }
    const known = new Map(input.items.map((i) => [i.name.toLowerCase(), i.name]));
    const usedItems = [...new Set(output.usedItems.map((n) => known.get(n.toLowerCase())).filter((n): n is string => !!n))];
    const reheatingNote = output.reheatingNote || (this.leftoversInvolved(input, output.answer) ? text.reheating : '');
    return { onTopic: true, answer: output.answer, reheatingNote, usedItems };
  }

  recheck(output: CookingAnswer, input: CookingAssistantInput): CookingAnswer {
    return this.check(output, input);
  }

  /** NFR-22: without a model, point at the items closest to expiry. */
  fallback(input: CookingAssistantInput): CookingAnswer {
    const text = TEXT[input.language];
    const soonest = input.items.slice(0, FALLBACK_ITEMS).map((i) => i.name);
    return {
      onTopic: true,
      answer: text.fallback(soonest),
      reheatingNote: this.leftoversInvolved(input, '') ? text.reheating : '',
      usedItems: soonest,
    };
  }

  confidence(output: CookingAnswer): number {
    return output.onTopic ? 0.9 : 1;
  }
}
