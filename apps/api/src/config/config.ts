import { z } from 'zod';

export const CONFIG = Symbol('CONFIG');

const optionalText = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));

const list = z
  .string()
  .transform((v) =>
    v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );

const ConfigSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().min(1),

    // Auth: Supabase tokens through the project's JWKS, or a shared HS256 secret locally.
    SUPABASE_URL: optionalText.pipe(z.url().optional()),
    AUTH_JWT_SECRET: optionalText,
    AUTH_JWT_ISSUER: z.string().default('elha2-dev'),

    // AI gateway (US-14.01). Providers are tried in the order listed; a provider without a key is skipped.
    AI_PROVIDERS: list.default(['gemini', 'groq']),
    AI_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
    AI_DAILY_RECEIPTS_PER_USER: z.coerce.number().int().positive().default(30),
    AI_CACHE_DAYS: z.coerce.number().int().positive().default(30),
    GEMINI_API_KEY: optionalText,
    GEMINI_MODEL: z.string().default('gemini-3.8-flash'),
    GEMINI_BASE_URL: z.url().default('https://generativelanguage.googleapis.com/v1beta'),
    GROQ_API_KEY: optionalText,
    GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),
    GROQ_BASE_URL: z.url().default('https://api.groq.com/openai/v1'),
  })
  .superRefine((c, ctx) => {
    if (!c.SUPABASE_URL && !c.AUTH_JWT_SECRET) {
      ctx.addIssue({ code: 'custom', message: 'Set SUPABASE_URL or AUTH_JWT_SECRET', path: ['SUPABASE_URL'] });
    }
    if (c.NODE_ENV === 'production' && !c.SUPABASE_URL) {
      ctx.addIssue({ code: 'custom', message: 'Production must verify Supabase tokens', path: ['SUPABASE_URL'] });
    }
  });

export type AppConfig = z.infer<typeof ConfigSchema>;

/** Reads apps/api/.env when present (local development), then validates. Never echoes values. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  if (env === process.env) {
    try {
      process.loadEnvFile();
    } catch {
      /* no .env file: deployed environments set real variables */
    }
  }
  const parsed = ConfigSchema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid configuration: ${problems}`);
  }
  return parsed.data;
}
