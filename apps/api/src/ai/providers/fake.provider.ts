import { type Completion, type CompletionRequest, type LlmProvider, ProviderError, type ProviderErrorCode } from './provider';

export type FakeStep = { text: string } | { error: ProviderErrorCode };

/** Scripted provider for tests: answers each call with the next step. */
export class FakeProvider implements LlmProvider {
  readonly calls: CompletionRequest[] = [];

  constructor(
    readonly name: string,
    private readonly steps: FakeStep[],
    readonly model = `${name}-fake`,
  ) {}

  complete(request: CompletionRequest): Promise<Completion> {
    this.calls.push(request);
    const step = this.steps.shift();
    if (!step) return Promise.reject(new ProviderError('unavailable', 'No scripted answer left'));
    if ('error' in step) return Promise.reject(new ProviderError(step.error));
    return Promise.resolve({ text: step.text, model: this.model, inputTokens: 100, outputTokens: 50 });
  }
}
