import type { AiStore, CachedAnswer, RequestLogEntry, StoredExample } from './ai.store';

/** In-memory AiStore for unit tests. */
export class MemoryAiStore implements AiStore {
  readonly logs: RequestLogEntry[] = [];
  readonly cache = new Map<string, CachedAnswer>();
  readonly usage = new Map<string, number>();
  corrected: string[] = [];

  getCache(key: string): Promise<CachedAnswer | null> {
    return Promise.resolve(this.cache.get(key) ?? null);
  }

  setCache(key: string, _task: string, _version: number, answer: CachedAnswer): Promise<void> {
    this.cache.set(key, answer);
    return Promise.resolve();
  }

  incrementUsage(userId: string, task: string, day: string): Promise<number> {
    const key = `${userId}:${task}:${day}`;
    const next = (this.usage.get(key) ?? 0) + 1;
    this.usage.set(key, next);
    return Promise.resolve(next);
  }

  examples(): Promise<StoredExample[]> {
    return Promise.resolve([]);
  }

  log(entry: RequestLogEntry): Promise<string> {
    this.logs.push(entry);
    return Promise.resolve(`req-${this.logs.length}`);
  }

  markCorrected(requestId: string): Promise<void> {
    this.corrected.push(requestId);
    return Promise.resolve();
  }
}
