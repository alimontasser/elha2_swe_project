import { type Completion, type CompletionRequest, type LlmProvider, postJson, ProviderError } from './provider';

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  modelVersion?: string;
}

/** Google Gemini through the REST generateContent endpoint, with a native JSON response schema. */
export class GeminiProvider implements LlmProvider {
  readonly name = 'gemini';

  constructor(
    private readonly apiKey: string,
    readonly model: string,
    private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta',
  ) {}

  async complete(request: CompletionRequest): Promise<Completion> {
    const url = `${this.baseUrl}/models/${encodeURIComponent(this.model)}:generateContent`;
    const data = (await postJson(
      url,
      { 'x-goog-api-key': this.apiKey },
      {
        systemInstruction: { parts: [{ text: request.system }] },
        contents: [{ role: 'user', parts: [{ text: request.user }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
          responseJsonSchema: request.jsonSchema,
        },
      },
      request.timeoutMs,
    )) as GeminiResponse;

    const candidate = data.candidates?.[0];
    const text = (candidate?.content?.parts ?? [])
      .filter((p) => !p.thought)
      .map((p) => p.text ?? '')
      .join('');
    if (!text) {
      throw new ProviderError('invalid_response', `No answer (finish reason ${candidate?.finishReason ?? 'unknown'})`);
    }
    return {
      text,
      model: data.modelVersion ?? this.model,
      inputTokens: data.usageMetadata?.promptTokenCount,
      outputTokens: data.usageMetadata?.candidatesTokenCount,
    };
  }
}
