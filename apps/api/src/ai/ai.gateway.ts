import { Inject, Injectable } from '@nestjs/common';
import { type AppConfig, CONFIG } from '../config/config';
import { CATALOGUE_MATCH, type ICatalogueMatch } from '../expiry/expiry.interfaces';
import {
  AI_PROVIDERS,
  AI_STORE,
  type AssistantAnswer,
  type IAI,
  type ProductReviewOutcome,
  type ReceiptPhotoReading,
  type ReceiptReading,
} from './ai.interfaces';
import type { AiStore } from './ai.store';
import type { ImagePart, LlmProvider } from './providers/provider';
import { AiTaskRunner } from './task-runner';
import { type CookingAssistantInput, CookingAssistantTask } from './tasks/cooking-assistant/cooking-assistant.task';
import { ParseReceiptTask } from './tasks/parse-receipt/parse-receipt.task';
import { ReadReceiptPhotoTask } from './tasks/read-receipt-photo/read-receipt-photo.task';
import { ReviewProductTask } from './tasks/review-product/review-product.task';

/** The single entry point to hosted AI models (Facade, SDD D4 / US-14.01). */
@Injectable()
export class AiGateway implements IAI {
  private readonly runner: AiTaskRunner;
  private readonly parseReceiptTask: ParseReceiptTask;
  private readonly cookingAssistantTask = new CookingAssistantTask();
  private readonly readReceiptPhotoTask = new ReadReceiptPhotoTask();
  private readonly reviewProductTask: ReviewProductTask;

  constructor(
    @Inject(CONFIG) private readonly config: AppConfig,
    @Inject(AI_PROVIDERS) providers: LlmProvider[],
    @Inject(AI_STORE) private readonly store: AiStore,
    @Inject(CATALOGUE_MATCH) catalogue: ICatalogueMatch,
  ) {
    this.runner = new AiTaskRunner(providers, store, { timeoutMs: config.AI_TIMEOUT_MS, cacheDays: config.AI_CACHE_DAYS });
    this.parseReceiptTask = new ParseReceiptTask(catalogue, store);
    this.reviewProductTask = new ReviewProductTask(catalogue);
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

  async readReceiptPhoto(photo: ImagePart, ctx: { userId: string }): Promise<ReceiptPhotoReading> {
    const outcome = await this.runner.run(
      this.readReceiptPhotoTask,
      { photo },
      { userId: ctx.userId, dailyLimit: this.config.AI_DAILY_RECEIPTS_PER_USER },
    );
    return { lines: outcome.result.lines, fallbackUsed: outcome.fallbackUsed, requestId: outcome.requestId };
  }

  async reviewProduct(input: { barcode: string; name: string }, ctx: { userId: string }): Promise<ProductReviewOutcome> {
    const outcome = await this.runner.run(this.reviewProductTask, input, {
      userId: ctx.userId,
      dailyLimit: this.config.AI_DAILY_PRODUCT_REVIEWS_PER_USER,
    });
    const r = outcome.result;
    return {
      decision: r.decision,
      reason: r.reason,
      nameAr: r.nameAr,
      nameEn: r.nameEn,
      category: r.category,
      catalogueId: r.catalogueId || null,
      quantity: r.quantity > 0 ? r.quantity : null,
      unit: r.quantity > 0 ? r.unit : null,
      confidence: r.confidence,
      fallbackUsed: outcome.fallbackUsed,
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
