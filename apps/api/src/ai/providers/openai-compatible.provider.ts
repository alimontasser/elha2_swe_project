import { type Completion, type CompletionRequest, type LlmProvider, postJson, ProviderError } from './provider';

interface ChatResponse {
  choices?: { message?: { content?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  model?: string;
}

/**
 * Any OpenAI-compatible chat API: Groq (the backup provider), OpenRouter or a local Ollama.
 * JSON mode is used; the schema itself is given in the system prompt.
 */
export class OpenAiCompatibleProvider implements LlmProvider {
  constructor(
    readonly name: string,
    private readonly baseUrl: string,
    private readonly apiKey: string,
    readonly model: string,
    /** A model that reads images, used only for requests with photos. */
    private readonly visionModel?: string,
  ) {}

  async complete(request: CompletionRequest): Promise<Completion> {
    const images = request.images ?? [];
    if (images.length && !this.visionModel) throw new ProviderError('bad_request', `${this.name} has no vision model configured`);
    const userContent = images.length
      ? [
          { type: 'text', text: request.user },
          ...images.map((i) => ({ type: 'image_url', image_url: { url: `data:${i.mimeType};base64,${i.base64}` } })),
        ]
      : request.user;
    const data = (await postJson(
      `${this.baseUrl.replace(/\/$/, '')}/chat/completions`,
      { authorization: `Bearer ${this.apiKey}` },
      {
        model: images.length ? this.visionModel : this.model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `${request.system}\n\nAnswer with one JSON object that matches this JSON Schema:\n${JSON.stringify(request.jsonSchema)}`,
          },
          { role: 'user', content: userContent },
        ],
      },
      request.timeoutMs,
    )) as ChatResponse;

    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new ProviderError('invalid_response', 'No answer');
    return {
      text,
      model: data.model ?? this.model,
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens,
    };
  }
}
