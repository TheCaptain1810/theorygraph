import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const root = path.resolve(import.meta.dirname, '..');

/** Loads e2e/.env when present; real environment variables (e.g. CI secrets) win. */
export function loadE2eEnv(): void {
  const file = path.join(root, 'e2e', '.env');
  if (existsSync(file)) process.loadEnvFile(file);
}

export function e2eDatabaseUrl(): string {
  const url =
    process.env.E2E_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/theorygraph_e2e';
  // This setup wipes the database. Refuse anything that is not clearly an e2e database.
  if (!/\/[^/?]*_e2e(\?|$)/.test(url)) {
    throw new Error('E2E_DATABASE_URL must point at a database whose name ends in "_e2e"');
  }
  return url;
}

export function requireCredentials(): { email: string; password: string; username: string } {
  const { E2E_EMAIL: email, E2E_PASSWORD: password, E2E_USERNAME: username } = process.env;
  if (!email || !password || !username) {
    throw new Error(
      'Set E2E_EMAIL, E2E_PASSWORD and E2E_USERNAME (see e2e/.env.example). The account must already exist in Supabase with a confirmed email.',
    );
  }
  return { email, password, username };
}

/** Migrates the e2e database, empties every table, then seeds the sample films. */
export default async function globalSetup(): Promise<void> {
  loadE2eEnv();
  requireCredentials();
  const url = e2eDatabaseUrl();
  const env = { ...process.env, DATABASE_URL: url };
  const server = path.join(root, 'server');

  execSync('npx prisma migrate deploy', { cwd: server, env, stdio: 'pipe' });

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
    );
    if (rows.length > 0) {
      const tables = rows.map((r) => `"${r.tablename}"`).join(', ');
      await client.query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
    }
  } finally {
    await client.end();
  }

  execSync('npx tsx prisma/seed.ts', { cwd: server, env, stdio: 'pipe' });
}
