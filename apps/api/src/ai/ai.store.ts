import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface RequestLogEntry {
  task: string;
  provider: string;
  model: string | null;
  promptVersion: number;
  inputHash: string;
  contextChars: number;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  confidence: number | null;
  fallbackUsed: boolean;
  fromCache: boolean;
  attempts: number;
  errorCodes: string[];
}

export interface CachedAnswer {
  response: unknown;
  provider: string;
  model: string | null;
}

export interface StoredExample {
  input: unknown;
  output: unknown;
}

/** Everything the AI gateway keeps. Owned by the gateway; lives in the "ai" schema. */
export interface AiStore {
  getCache(key: string, now: Date): Promise<CachedAnswer | null>;
  setCache(key: string, task: string, promptVersion: number, answer: CachedAnswer, expiresAt: Date): Promise<void>;
  /** Adds one call for the user today and returns the new count. */
  incrementUsage(userId: string, task: string, day: string): Promise<number>;
  examples(task: string, limit: number): Promise<StoredExample[]>;
  log(entry: RequestLogEntry): Promise<string>;
  markCorrected(requestId: string): Promise<void>;
}

@Injectable()
export class PrismaAiStore implements AiStore {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async getCache(key: string, now: Date): Promise<CachedAnswer | null> {
    const row = await this.db.aiResponseCache.findUnique({ where: { key } });
    if (!row || row.expiresAt <= now) return null;
    return { response: row.response, provider: row.provider, model: row.model };
  }

  async setCache(key: string, task: string, promptVersion: number, answer: CachedAnswer, expiresAt: Date): Promise<void> {
    const data = {
      task,
      promptVersion,
      response: answer.response as Prisma.InputJsonValue,
      provider: answer.provider,
      model: answer.model,
      expiresAt,
    };
    await this.db.aiResponseCache.upsert({ where: { key }, create: { key, ...data }, update: data });
  }

  async incrementUsage(userId: string, task: string, day: string): Promise<number> {
    const rows = await this.db.$queryRaw<{ count: number }[]>`
      INSERT INTO ai.daily_usage (user_id, day, task, count)
      VALUES (${userId}::uuid, ${day}::date, ${task}, 1)
      ON CONFLICT (user_id, day, task) DO UPDATE SET count = ai.daily_usage.count + 1
      RETURNING count`;
    return Number(rows[0].count);
  }

  async examples(task: string, limit: number): Promise<StoredExample[]> {
    const rows = await this.db.aiExample.findMany({ where: { task }, orderBy: { createdAt: 'asc' }, take: limit });
    return rows.map((r) => ({ input: r.input, output: r.output }));
  }

  async log(entry: RequestLogEntry): Promise<string> {
    const row = await this.db.aiRequestLog.create({
      data: {
        ...entry,
        model: entry.model,
        confidence: entry.confidence === null ? null : new Prisma.Decimal(entry.confidence.toFixed(3)),
      },
    });
    return row.id;
  }

  async markCorrected(requestId: string): Promise<void> {
    await this.db.aiRequestLog.updateMany({ where: { id: requestId }, data: { userCorrected: true } });
  }
}
