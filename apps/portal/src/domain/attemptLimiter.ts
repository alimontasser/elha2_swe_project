// US-1.01: at most `maxAttempts` wrong codes per number within `windowMs`; then the number is
// locked until the oldest failure leaves the window. Shared by the mock and the Supabase adapter.
export interface AttemptLimiter {
  lockedUntil(key: string): Date | null
  recordFailure(key: string): number
  clear(key: string): void
  reset(): void
}

export interface LimiterOptions {
  maxAttempts?: number
  windowMs?: number
  now?: () => Date
  /** Persists the counter, e.g. in localStorage, so a reload does not reset it. */
  load?: () => string | null
  save?: (json: string) => void
}

export function createAttemptLimiter({
  maxAttempts = 5,
  windowMs = 60 * 60 * 1000,
  now = () => new Date(),
  load,
  save,
}: LimiterOptions = {}): AttemptLimiter {
  const failures = new Map<string, number[]>()
  try {
    const raw = load?.()
    if (raw) for (const [k, v] of Object.entries(JSON.parse(raw) as Record<string, number[]>)) failures.set(k, v)
  } catch {
    /* a corrupt store only loses the counter */
  }
  const persist = () => save?.(JSON.stringify(Object.fromEntries(failures)))

  function recent(key: string): number[] {
    const cutoff = now().getTime() - windowMs
    const list = (failures.get(key) ?? []).filter((t) => t > cutoff)
    if (list.length) failures.set(key, list)
    else failures.delete(key)
    return list
  }

  return {
    lockedUntil(key) {
      const list = recent(key)
      return list.length >= maxAttempts ? new Date(list[0] + windowMs) : null
    },
    recordFailure(key) {
      const list = [...recent(key), now().getTime()]
      failures.set(key, list)
      persist()
      return maxAttempts - list.length
    },
    clear(key) {
      failures.delete(key)
      persist()
    },
    reset() {
      failures.clear()
      persist()
    },
  }
}
