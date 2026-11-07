import { createHash } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { z } from 'zod';
import { cairoDate } from '../common/text';
import type { AiStore } from './ai.store';
import { type ImagePart, type LlmProvider, ProviderError } from './providers/provider';

/** The context a task's prompt is built from (SDD Fig. 3.5, steps 1–4). */
export interface PreparedPrompt<S> {
  system: string;
  user: string;
  /** Photos the model reads with the prompt, e.g. a receipt photo. Never cached or logged. */
  images?: ImagePart[];
  /** Task-specific data reused by the checks and the fallback, e.g. catalogue candidates. */
  state: S;
}

/**
 * One AI task, such as reading a receipt. The runner applies the same steps to every task
 * (Template method, SDD §3.1.4); only these parts change per task.
 */
export interface AiTask<I, O, S> {
  readonly name: string;
  readonly promptVersion: number;
  readonly schema: z.ZodType<O>;
  readonly jsonSchema: Record<string, unknown>;
  /** Step 4: hide personal data and trim to the size limit. */
  sanitise(input: I): { input: I; maskedCount: number };
  /** A stable text form of the sanitised input, for the cache key and the log hash. */
  canonical(input: I): string;
  /** Steps 1–3: template, retrieved context and worked examples. */
  prepare(input: I): Promise<PreparedPrompt<S>>;
  /** Step 6, beyond the schema: domain checks that repair or drop what cannot be trusted. */
  check(output: O, input: I, state: S): O;
  /**
   * Optional: checks that need no prepared state, re-applied to cached answers so a rule added
   * later (e.g. a new NFR-07 safety pattern) also covers answers cached before it.
   */
  recheck?(output: O, input: I): O;
  /** The non-AI path (NFR-22). */
  fallback(input: I, state: S): O;
  confidence(output: O): number;
}

export interface RunContext {
  userId: string;
  dailyLimit: number;
}

export interface AiOutcome<I, O> {
  /** The input after masking and trimming, as the model saw it. */
  input: I;
  result: O;
  confidence: number;
  fallbackUsed: boolean;
  fromCache: boolean;
  provider: string;
  model: string | null;
  promptVersion: number;
  requestId: string;
  maskedCount: number;
}

export interface RunnerOptions {
  timeoutMs: number;
  cacheDays: number;
  now?: () => Date;
}

function stripFences(text: string): string {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed);
  return fenced ? fenced[1] : trimmed;
}

function describeIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 5)
    .map((i) => `${i.path.join('.') || 'answer'}: ${i.message}`)
    .join('; ');
}

/**
 * Runs every AI call the same way (US-14.01, SDD Fig. 3.5):
 * cache → daily cap → each provider in order (15 s time-out; one retry with the validation error) →
 * the non-AI fallback. Logs one row per call, without personal data.
 */
export class AiTaskRunner {
  private readonly logger = new Logger('AiGateway');
  private readonly now: () => Date;

  constructor(
    private readonly providers: LlmProvider[],
    private readonly store: AiStore,
    private readonly options: RunnerOptions,
  ) {
    this.now = options.now ?? (() => new Date());
  }

  async run<I, O, S>(task: AiTask<I, O, S>, rawInput: I, ctx: RunContext): Promise<AiOutcome<I, O>> {
    const started = Date.now();
    const { input, maskedCount } = task.sanitise(rawInput);
    if (maskedCount > 0) {
      this.logger.warn(`${task.name}: hid ${maskedCount} personal detail(s) that the phone did not mask`);
    }
    const inputHash = createHash('sha256')
      .update(`${task.name}:v${task.promptVersion}:${task.canonical(input)}`)
      .digest('hex');
    const base = { task: task.name, promptVersion: task.promptVersion, inputHash };

    const cached = await this.store.getCache(inputHash, this.now());
    if (cached) {
      const parsed = task.schema.safeParse(cached.response);
      if (parsed.success) {
        const result = task.recheck ? task.recheck(parsed.data, input) : parsed.data;
        const confidence = task.confidence(result);
        const requestId = await this.store.log({
          ...base,
          provider: cached.provider,
          model: cached.model,
          contextChars: 0,
          latencyMs: Date.now() - started,
          confidence,
          fallbackUsed: false,
          fromCache: true,
          attempts: 0,
          errorCodes: [],
        });
        return {
          input,
          result,
          confidence,
          fallbackUsed: false,
          fromCache: true,
          provider: cached.provider,
          model: cached.model,
          promptVersion: task.promptVersion,
          requestId,
          maskedCount,
        };
      }
    }

    const prompt = await task.prepare(input);
    const contextChars = prompt.system.length + prompt.user.length;
    const errorCodes: string[] = [];
    let attempts = 0;

    const used = await this.store.incrementUsage(ctx.userId, task.name, cairoDate(this.now()));
    const providers = used > ctx.dailyLimit ? [] : this.providers;
    if (used > ctx.dailyLimit) errorCodes.push('daily_cap');

    for (const provider of providers) {
      let feedback = '';
      for (let attempt = 1; attempt <= 2; attempt++) {
        attempts++;
        try {
          const completion = await provider.complete({
            system: prompt.system,
            user: feedback ? `${prompt.user}\n\n${feedback}` : prompt.user,
            jsonSchema: task.jsonSchema,
            timeoutMs: this.options.timeoutMs,
            images: prompt.images,
          });
          let json: unknown;
          try {
            json = JSON.parse(stripFences(completion.text));
          } catch {
            errorCodes.push(`${provider.name}:invalid_json`);
            feedback = 'Your previous answer was not valid JSON. Answer again with one JSON object only.';
            continue;
          }
          const parsed = task.schema.safeParse(json);
          if (!parsed.success) {
            errorCodes.push(`${provider.name}:invalid_answer`);
            feedback = `Your previous answer did not match the schema (${describeIssues(parsed.error)}). Answer again with JSON only.`;
            continue;
          }
          const result = task.check(parsed.data, input, prompt.state);
          const confidence = task.confidence(result);
          const answer = { response: result, provider: provider.name, model: completion.model };
          const expiresAt = new Date(this.now().getTime() + this.options.cacheDays * 86_400_000);
          await this.store.setCache(inputHash, task.name, task.promptVersion, answer, expiresAt);
          const requestId = await this.store.log({
            ...base,
            provider: provider.name,
            model: completion.model,
            contextChars,
            latencyMs: Date.now() - started,
            inputTokens: completion.inputTokens,
            outputTokens: completion.outputTokens,
            confidence,
            fallbackUsed: false,
            fromCache: false,
            attempts,
            errorCodes,
          });
          return {
            input,
            result,
            confidence,
            fallbackUsed: false,
            fromCache: false,
            provider: provider.name,
            model: completion.model,
            promptVersion: task.promptVersion,
            requestId,
            maskedCount,
          };
        } catch (error) {
          if (!(error instanceof ProviderError)) throw error;
          errorCodes.push(`${provider.name}:${error.code}`);
          this.logger.warn(`${task.name}: ${provider.name} failed with ${error.code}`);
          if (!error.retryable) break;
        }
      }
    }

    const result = task.fallback(input, prompt.state);
    const confidence = task.confidence(result);
    const requestId = await this.store.log({
      ...base,
      provider: 'fallback',
      model: null,
      contextChars,
      latencyMs: Date.now() - started,
      confidence,
      fallbackUsed: true,
      fromCache: false,
      attempts,
      errorCodes,
    });
    return {
      input,
      result,
      confidence,
      fallbackUsed: true,
      fromCache: false,
      provider: 'fallback',
      model: null,
      promptVersion: task.promptVersion,
      requestId,
      maskedCount,
    };
  }
}
