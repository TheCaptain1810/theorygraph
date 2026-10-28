import { z } from 'zod';
import { ApiError } from './errors.js';

/** Film metadata as this app stores it. Provider-specific shapes never leave this module. */
export interface FilmCandidate {
  tmdbId: number;
  title: string;
  releaseYear: number | null;
  posterPath: string | null;
}

export interface FilmMetadata extends FilmCandidate {
  director: string | null;
}

export interface FilmMetadataProvider {
  search(query: string): Promise<FilmCandidate[]>;
  /** Null when the provider has no such film. Throws ApiError(502) when the provider is unavailable. */
  getFilm(tmdbId: number): Promise<FilmMetadata | null>;
}

const API = 'https://api.themoviedb.org/3';
const SEARCH_LIMIT = 10;

/** TMDB poster paths look like "/abc123.jpg". Anything else is dropped, since the web app builds image URLs from it. */
const POSTER_RE = /^\/[A-Za-z0-9_-]{1,100}\.(?:jpg|jpeg|png|webp)$/;
const posterOrNull = (v: string | null | undefined) => (v && POSTER_RE.test(v) ? v : null);

const yearOf = (date: string | null | undefined): number | null => {
  const m = date?.match(/^(\d{4})-/);
  const y = m?.[1] ? Number(m[1]) : NaN;
  return y >= 1850 && y <= 2200 ? y : null;
};

const titleField = z.string().trim().min(1).max(300);

const searchResponse = z.object({
  results: z.array(
    z.object({
      id: z.number().int().positive(),
      title: titleField,
      release_date: z.string().nullish(),
      poster_path: z.string().nullish(),
    }),
  ),
});

const movieResponse = z.object({
  id: z.number().int().positive(),
  title: titleField,
  release_date: z.string().nullish(),
  poster_path: z.string().nullish(),
  credits: z
    .object({
      crew: z.array(z.object({ job: z.string().nullish(), name: z.string().nullish() })),
    })
    .optional(),
});

function unavailable(): ApiError {
  return new ApiError(502, 'metadata_unavailable', 'Film search is temporarily unavailable');
}

/**
 * TMDB v3. Accepts either a v3 API key (sent as a query parameter) or a v4 read-access token
 * (a JWT, sent as a bearer header). The credential is never logged or included in errors.
 */
export function tmdbProvider(opts: {
  apiKey: string;
  fetchImpl?: typeof fetch;
}): FilmMetadataProvider {
  const doFetch = opts.fetchImpl ?? fetch;
  const isToken = opts.apiKey.startsWith('eyJ');

  async function get(path: string, params: Record<string, string>): Promise<unknown | null> {
    const url = new URL(`${API}${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    if (!isToken) url.searchParams.set('api_key', opts.apiKey);
    let res: Response;
    try {
      res = await doFetch(url, {
        headers: {
          Accept: 'application/json',
          ...(isToken ? { Authorization: `Bearer ${opts.apiKey}` } : {}),
        },
        signal: AbortSignal.timeout(6000),
      });
    } catch {
      throw unavailable(); // network error or timeout; details deliberately omitted (URL holds the key)
    }
    if (res.status === 404) return null;
    // 401/403 mean our credential is wrong and 429/5xx mean TMDB is struggling: all are "unavailable" to users.
    if (!res.ok) throw unavailable();
    try {
      return await res.json();
    } catch {
      throw unavailable();
    }
  }

  return {
    async search(query) {
      const body = await get('/search/movie', {
        query,
        include_adult: 'false',
        page: '1',
      });
      const parsed = searchResponse.safeParse(body);
      if (!parsed.success) throw unavailable();
      return parsed.data.results.slice(0, SEARCH_LIMIT).map((r) => ({
        tmdbId: r.id,
        title: r.title,
        releaseYear: yearOf(r.release_date),
        posterPath: posterOrNull(r.poster_path),
      }));
    },

    async getFilm(tmdbId) {
      const body = await get(`/movie/${tmdbId}`, { append_to_response: 'credits' });
      if (body === null) return null;
      const parsed = movieResponse.safeParse(body);
      if (!parsed.success) throw unavailable();
      const m = parsed.data;
      const directors = (m.credits?.crew ?? [])
        .filter((c) => c.job === 'Director' && c.name)
        .map((c) => c.name!.trim())
        .filter(Boolean)
        .slice(0, 3);
      return {
        tmdbId: m.id,
        title: m.title,
        releaseYear: yearOf(m.release_date),
        posterPath: posterOrNull(m.poster_path),
        director: directors.length > 0 ? directors.join(', ') : null,
      };
    },
  };
}
