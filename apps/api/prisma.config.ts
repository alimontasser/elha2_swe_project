import { defineConfig } from 'prisma/config';

// Local development reads apps/api/.env; deployed environments set real variables.
try {
  process.loadEnvFile();
} catch {
  /* no .env file */
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
