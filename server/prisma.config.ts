import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Fallback lets `prisma generate` run in a fresh clone (postinstall) before .env exists.
    // Migrate/seed/runtime still need a real DATABASE_URL and will fail to connect without one.
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/theorygraph',
  },
});
