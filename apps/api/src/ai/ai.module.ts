import { Logger, Module } from '@nestjs/common';
import { type AppConfig, CONFIG } from '../config/config';
import { ExpiryModule } from '../expiry/expiry.module';
import { AiGateway } from './ai.gateway';
import { AI, AI_PROVIDERS, AI_STORE } from './ai.interfaces';
import { PrismaAiStore } from './ai.store';
import { GeminiProvider } from './providers/gemini.provider';
import { OpenAiCompatibleProvider } from './providers/openai-compatible.provider';
import type { LlmProvider } from './providers/provider';

/** Providers in the configured order; one without a key is skipped (Strategy, SDD §3.1.4). */
export function providersFromConfig(config: AppConfig): LlmProvider[] {
  const logger = new Logger('AiGateway');
  const providers: LlmProvider[] = [];
  for (const name of config.AI_PROVIDERS) {
    if (name === 'gemini' && config.GEMINI_API_KEY) {
      providers.push(new GeminiProvider(config.GEMINI_API_KEY, config.GEMINI_MODEL, config.GEMINI_BASE_URL));
    } else if (name === 'groq' && config.GROQ_API_KEY) {
      providers.push(
        new OpenAiCompatibleProvider('groq', config.GROQ_BASE_URL, config.GROQ_API_KEY, config.GROQ_MODEL, config.GROQ_VISION_MODEL),
      );
    } else {
      logger.warn(`AI provider "${name}" is not configured and will be skipped`);
    }
  }
  return providers;
}

@Module({
  imports: [ExpiryModule],
  providers: [
    { provide: AI_PROVIDERS, inject: [CONFIG], useFactory: providersFromConfig },
    { provide: AI_STORE, useClass: PrismaAiStore },
    AiGateway,
    { provide: AI, useExisting: AiGateway },
  ],
  exports: [AI],
})
export class AiModule {}
