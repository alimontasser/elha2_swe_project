// Times Gemini models and thinking settings on the real receipt prompt, to choose GEMINI_MODEL.
// Prints model, status, latency and token counts only.
//   pnpm tsx scripts/probe-gemini.ts gemini-3.8-flash gemini-2.5-flash ...
import { NestFactory } from '@nestjs/core';
import { AI_STORE } from '../src/ai/ai.interfaces';
import type { AiStore } from '../src/ai/ai.store';
import { ParseReceiptTask } from '../src/ai/tasks/parse-receipt/parse-receipt.task';
import { PARSE_RECEIPT_JSON_SCHEMA } from '../src/ai/tasks/parse-receipt/schema';
import { AppModule } from '../src/app.module';
import { loadConfig } from '../src/config/config';
import { CATALOGUE_MATCH, type ICatalogueMatch } from '../src/expiry/expiry.interfaces';
import { loadLabelledReceipts } from './seed';

type Thinking = 'default' | 'off' | 'low';

async function main() {
  const config = loadConfig();
  const app = await NestFactory.createApplicationContext(AppModule.forRoot(config), { logger: ['error'] });
  const task = new ParseReceiptTask(app.get<ICatalogueMatch>(CATALOGUE_MATCH), app.get<AiStore>(AI_STORE));
  const receipt = loadLabelledReceipts().find((r) => r.id === 'demo-nile-market')!;
  const prompt = await task.prepare(task.sanitise({ lines: receipt.lines, shopName: receipt.shopName }).input);
  await app.close();

  const models = process.argv.slice(2);
  for (const model of models) {
    for (const thinking of ['default', 'off', 'low'] as Thinking[]) {
      const generationConfig: Record<string, unknown> = {
        temperature: 0,
        responseMimeType: 'application/json',
        responseJsonSchema: PARSE_RECEIPT_JSON_SCHEMA,
      };
      if (thinking === 'off') generationConfig.thinkingConfig = { thinkingBudget: 0 };
      if (thinking === 'low') generationConfig.thinkingConfig = { thinkingLevel: 'low' };
      const started = Date.now();
      try {
        const res = await fetch(`${config.GEMINI_BASE_URL}/models/${model}:generateContent`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': config.GEMINI_API_KEY! },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: prompt.system }] },
            contents: [{ role: 'user', parts: [{ text: prompt.user }] }],
            generationConfig,
          }),
          signal: AbortSignal.timeout(60_000),
        });
        const body = (await res.json()) as {
          usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
          candidates?: { content?: { parts?: { text?: string }[] } }[];
          error?: { status?: string };
        };
        const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
        let items = '-';
        try {
          items = String((JSON.parse(text) as { items: unknown[] }).items.length);
        } catch {
          /* not JSON */
        }
        console.log(
          `${model.padEnd(26)} thinking=${thinking.padEnd(7)} ${res.status} ${String(Date.now() - started).padStart(6)} ms  items=${items}  in=${body.usageMetadata?.promptTokenCount ?? '-'} out=${body.usageMetadata?.candidatesTokenCount ?? '-'} thoughts=${body.usageMetadata?.thoughtsTokenCount ?? 0} ${body.error?.status ?? ''}`,
        );
      } catch (error) {
        console.log(`${model.padEnd(26)} thinking=${thinking.padEnd(7)} failed after ${Date.now() - started} ms: ${(error as Error).name}`);
      }
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
