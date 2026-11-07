import { Inject, Injectable } from '@nestjs/common';
import { type AppConfig, CONFIG } from '../config/config';
import { CATALOGUE_MATCH, type ICatalogueMatch } from '../expiry/expiry.interfaces';
import { AI_PROVIDERS, AI_STORE, type AssistantAnswer, type IAI, type ReceiptReading } from './ai.interfaces';
import type { AiStore } from './ai.store';
import type { LlmProvider } from './providers/provider';
import { AiTaskRunner } from './task-runner';
import { type CookingAssistantInput, CookingAssistantTask } from './tasks/cooking-assistant/cooking-assistant.task';
import { ParseReceiptTask } from './tasks/parse-receipt/parse-receipt.task';

/** The single entry point to hosted AI models (Facade, SDD D4 / US-14.01). */
@Injectable()
export class AiGateway implements IAI {
  private readonly runner: AiTaskRunner;
  private readonly parseReceiptTask: ParseReceiptTask;
  private readonly cookingAssistantTask = new CookingAssistantTask();

  constructor(
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(AI_PROVIDERS) providers: LlmProvider[],
    @Inject(AI_STORE) private readonly store: AiStore,
    @Inject(CATALOGUE_MATCH) catalogue: ICatalogueMatch,
  ) {
    this.runner = new AiTaskRunner(providers, store, { timeoutMs: config.AI_TIMEOUT_MS, cacheDays: config.AI_CACHE_DAYS });
    this.parseReceiptTask = new ParseReceiptTask(catalogue, store);
  }

  async parseReceipt(lines: string[], ctx: { userId: string; shopName?: string }): Promise<ReceiptReading> {
    const outcome = await this.runner.run(
      this.parseReceiptTask,
      { lines, shopName: ctx.shopName },
      { userId: ctx.userId, dailyLimit: this.config.AI_DAILY_RECEIPTS_PER_USER },
    );
    return {
      lines: outcome.input.lines,
      items: outcome.result.items,
      confidence: outcome.confidence,
      fallbackUsed: outcome.fallbackUsed,
      provider: outcome.provider,
      promptVersion: outcome.promptVersion,
      requestId: outcome.requestId,
    };
  }

  async askCookingAssistant(input: CookingAssistantInput, ctx: { userId: string }): Promise<AssistantAnswer> {
    const outcome = await this.runner.run(this.cookingAssistantTask, input, {
      userId: ctx.userId,
      dailyLimit: this.config.AI_DAILY_CHAT_PER_USER,
    });
    return {
      ...outcome.result,
      language: outcome.input.language,
      fallbackUsed: outcome.fallbackUsed,
      requestId: outcome.requestId,
    };
  }

  recordCorrection(requestId: string): Promise<void> {
    return this.store.markCorrected(requestId);
  }
}
