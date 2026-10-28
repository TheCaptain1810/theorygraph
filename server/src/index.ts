import 'dotenv/config';
import { createApp } from './app.js';
import { disabledVerifier, supabaseVerifier } from './auth.js';
import { loadConfig } from './config.js';
import { createPrismaClient, createPrismaRepository } from './repo/prisma.js';
import { tmdbProvider } from './tmdb.js';

const config = loadConfig();
const db = createPrismaClient(config.DATABASE_URL);

const auth =
  config.SUPABASE_URL && config.SUPABASE_ANON_KEY
    ? supabaseVerifier({ url: config.SUPABASE_URL, anonKey: config.SUPABASE_ANON_KEY })
    : disabledVerifier;
if (auth === disabledVerifier) {
  console.warn(
    JSON.stringify({
      level: 'warn',
      msg: 'Supabase not configured: all write endpoints will return 401',
    }),
  );
}

if (!config.TMDB_API_KEY) {
  console.warn(
    JSON.stringify({ level: 'warn', msg: 'TMDB_API_KEY not set: film search/import disabled' }),
  );
}

const app = createApp({
  repo: createPrismaRepository(db),
  auth,
  webOrigin: config.WEB_ORIGIN,
  ...(config.TMDB_API_KEY ? { metadata: tmdbProvider({ apiKey: config.TMDB_API_KEY }) } : {}),
  isProduction: config.NODE_ENV === 'production',
});

const server = app.listen(config.PORT, () => {
  console.log(JSON.stringify({ level: 'info', msg: 'api listening', port: config.PORT }));
});

const shutdown = () => {
  server.close(() => {
    void db.$disconnect().finally(() => process.exit(0));
  });
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
