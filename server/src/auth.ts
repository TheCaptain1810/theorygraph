import type { RequestHandler } from 'express';
import { ApiError } from './errors.js';
import type { AppUser } from './domain/types.js';
import type { Repository } from './repo/types.js';

export interface VerifiedIdentity {
  id: string;
  usernameHint: string;
}

/** Verifies a bearer token with the auth provider. Returns null when invalid. */
export interface AuthVerifier {
  verify(token: string): Promise<VerifiedIdentity | null>;
}

/**
 * Supabase Auth: asks the Supabase Auth server who owns the access token (GET /auth/v1/user).
 * Needs only SUPABASE_URL and SUPABASE_ANON_KEY; no service-role key is required.
 * NOTE: not yet exercised against a live Supabase project; see README "Known gaps".
 */
export function supabaseVerifier(opts: { url: string; anonKey: string }): AuthVerifier {
  const base = opts.url.replace(/\/+$/, '');
  return {
    async verify(token) {
      try {
        const res = await fetch(`${base}/auth/v1/user`, {
          headers: { apikey: opts.anonKey, Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return null;
        const body = (await res.json()) as {
          id?: unknown;
          email?: unknown;
          user_metadata?: { username?: unknown };
        };
        if (typeof body.id !== 'string') return null;
        const metaName = body.user_metadata?.username;
        const emailLocal = typeof body.email === 'string' ? body.email.split('@')[0] : undefined;
        const hint = typeof metaName === 'string' && metaName ? metaName : (emailLocal ?? '');
        return { id: body.id, usernameHint: hint };
      } catch {
        return null;
      }
    },
  };
}

/** Used when Supabase is not configured: every authenticated write is refused (reads still work). */
export const disabledVerifier: AuthVerifier = {
  async verify() {
    return null;
  },
};

declare module 'express-serve-static-core' {
  interface Request {
    user?: AppUser;
  }
}

/** The current user is derived ONLY from the verified token, never from the request body. */
export function requireAuth(verifier: AuthVerifier, repo: Repository): RequestHandler {
  return async (req, _res, next) => {
    const header = req.header('authorization');
    const match = header?.match(/^Bearer\s+(\S+)$/i);
    if (!match?.[1]) throw new ApiError(401, 'unauthenticated', 'Sign in to continue');
    const identity = await verifier.verify(match[1]);
    if (!identity) throw new ApiError(401, 'unauthenticated', 'Your session is invalid or expired');
    req.user = await repo.ensureUser(identity);
    next();
  };
}

/** Deterministic, safe username for first-time profiles. Collisions are resolved by the repository. */
export function sanitizeUsername(hint: string, id: string): string {
  const cleaned = hint
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 24);
  return cleaned.length >= 3 ? cleaned : `user_${id.replace(/-/g, '').slice(0, 8)}`;
}
