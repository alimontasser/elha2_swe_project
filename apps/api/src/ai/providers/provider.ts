export type ProviderErrorCode =
  'timeout' | 'rate_limited' | 'unavailable' | 'network' | 'auth' | 'bad_request' | 'model_not_found' | 'invalid_response';

/** Errors worth one more try on the same provider; the rest go straight to the next provider. */
const RETRYABLE: ReadonlySet<ProviderErrorCode> = new Set(['unavailable', 'network', 'invalid_response']);

export class ProviderError extends Error {
  constructor(
    readonly code: ProviderErrorCode,
    message?: string,
  ) {
    super(message ?? code);
  }

  get retryable(): boolean {
    return RETRYABLE.has(this.code);
  }
}

export interface CompletionRequest {
  system: string;
  user: string;
  /** JSON Schema of the expected answer. Providers that support it enforce it natively. */
  jsonSchema: Record<string, unknown>;
  timeoutMs: number;
  /** Photos sent with the prompt (receipt photos). Providers that cannot read images refuse with bad_request. */
  images?: ImagePart[];
}

export interface ImagePart {
  mimeType: string;
  base64: string;
}

export interface Completion {
  text: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}

/** A hosted model behind the AI gateway (Adapter pattern, SDD §3.1.4). */
export interface LlmProvider {
  readonly name: string;
  readonly model: string;
  complete(request: CompletionRequest): Promise<Completion>;
}

export function statusToError(status: number, body: string): ProviderError {
  const detail = body.slice(0, 300);
  if (status === 401 || status === 403) return new ProviderError('auth', detail);
  if (status === 404) return new ProviderError('model_not_found', detail);
  if (status === 408) return new ProviderError('timeout', detail);
  if (status === 429) return new ProviderError('rate_limited', detail);
  if (status >= 500) return new ProviderError('unavailable', detail);
  return new ProviderError('bad_request', detail);
}

export async function postJson(url: string, headers: Record<string, string>, body: unknown, timeoutMs: number) {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const name = (error as { name?: string }).name;
    if (name === 'TimeoutError' || name === 'AbortError') throw new ProviderError('timeout');
    throw new ProviderError('network', (error as Error).message);
  }
  const text = await res.text();
  if (!res.ok) throw statusToError(res.status, text);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ProviderError('invalid_response', 'The provider did not return JSON');
  }
}
