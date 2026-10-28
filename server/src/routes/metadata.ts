import { Router } from 'express';
import type { RequestHandler } from 'express';
import { z } from 'zod';
import type { Repository } from '../repo/types.js';
import { ApiError, notFound } from '../errors.js';
import type { FilmMetadataProvider } from '../tmdb.js';

const PROVIDER = 'tmdb';
// Required attribution text, stored with each imported film and shown wherever its metadata appears.
const ATTRIBUTION = 'TMDB (The Movie Database)';

const searchQuery = z.object({ query: z.string().trim().min(2).max(100) });
const importInput = z.object({ tmdbId: z.number().int().positive().max(100_000_000) });

/**
 * External film metadata. Signed-in users only (so anonymous traffic cannot spend our TMDB quota),
 * rate limited, and import always re-fetches from TMDB server-side: the client only names a film id
 * and can never supply the title, year or poster that gets stored.
 */
export function metadataRoutes(
  repo: Repository,
  auth: RequestHandler,
  limiter: RequestHandler,
  provider: FilmMetadataProvider | undefined,
): Router {
  const r = Router();

  const requireProvider = (): FilmMetadataProvider => {
    if (!provider) {
      throw new ApiError(503, 'metadata_unavailable', 'Film search is not configured');
    }
    return provider;
  };

  r.get('/search', limiter, auth, async (req, res) => {
    const { query } = searchQuery.parse(req.query);
    const results = await requireProvider().search(query);
    const known = await repo.findFilmIdsByProvider(
      PROVIDER,
      results.map((c) => String(c.tmdbId)),
    );
    res.json({
      items: results.map((c) => ({ ...c, filmId: known[String(c.tmdbId)] ?? null })),
      attribution: ATTRIBUTION,
    });
  });

  r.post('/import', limiter, auth, async (req, res) => {
    const { tmdbId } = importInput.parse(req.body);
    const p = requireProvider();

    const known = await repo.findFilmIdsByProvider(PROVIDER, [String(tmdbId)]);
    const existingId = known[String(tmdbId)];
    if (existingId) {
      const film = await repo.getFilm(existingId);
      if (film) {
        res.json({ film, created: false });
        return;
      }
    }

    const meta = await p.getFilm(tmdbId);
    if (!meta) throw notFound('Film');
    const { film, created } = await repo.createFilmIfMissing({
      provider: PROVIDER,
      providerFilmId: String(meta.tmdbId),
      title: meta.title,
      releaseYear: meta.releaseYear,
      director: meta.director,
      posterPath: meta.posterPath,
      metadataAttribution: ATTRIBUTION,
    });
    res.status(created ? 201 : 200).json({ film, created });
  });

  return r;
}
