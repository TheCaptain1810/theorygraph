import cors from 'cors';
import express from 'express';
import type { RequestHandler } from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { requireAuth, type AuthVerifier } from './auth.js';
import { errorHandler, notFoundHandler } from './errors.js';
import type { Repository } from './repo/types.js';
import { filmRoutes } from './routes/films.js';
import { counterReadingRoutes, interpretationRoutes } from './routes/interpretations.js';
import { metadataRoutes } from './routes/metadata.js';
import { moderationRoutes, reportRoutes } from './routes/reports.js';
import type { FilmMetadataProvider } from './tmdb.js';
import { userRoutes } from './routes/users.js';

export interface AppDeps {
  repo: Repository;
  auth: AuthVerifier;
  webOrigin: string;
  /** External film metadata (TMDB). When absent, /api/metadata returns 503. */
  metadata?: FilmMetadataProvider;
  isProduction?: boolean;
  /** Max write requests per IP per minute. */
  writeLimitPerMinute?: number;
}

export function createApp(deps: AppDeps) {
  const app = express();
  app.disable('x-powered-by');
  if (deps.isProduction) app.set('trust proxy', 1); // behind Render/Railway; adjust to your host

  app.use(helmet());
  app.use(cors({ origin: deps.webOrigin }));
  app.use(express.json({ limit: '100kb' }));

  const writeLimiter: RequestHandler = rateLimit({
    windowMs: 60_000,
    limit: deps.writeLimitPerMinute ?? 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        error: { code: 'rate_limited', message: 'Too many requests. Try again shortly.' },
      });
    },
  });
  const auth = requireAuth(deps.auth, deps.repo);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  // Who am I: profile and role as stored in the database (the token only proves identity).
  app.get('/api/me', auth, (req, res) => {
    const { id, username, role } = req.user!;
    res.json({ user: { id, username, role } });
  });
  app.use('/api/metadata', metadataRoutes(deps.repo, auth, writeLimiter, deps.metadata));
  app.use('/api/users', userRoutes(deps.repo));
  app.use('/api/films', filmRoutes(deps.repo));
  app.use('/api/interpretations', interpretationRoutes(deps.repo, auth, writeLimiter));
  app.use('/api/counter-readings', counterReadingRoutes(deps.repo, auth, writeLimiter));
  app.use('/api/reports', reportRoutes(deps.repo, auth, writeLimiter));
  app.use('/api/moderation', moderationRoutes(deps.repo, auth, writeLimiter));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
