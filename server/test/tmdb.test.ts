import { describe, expect, it, vi } from 'vitest';
import { tmdbProvider } from '../src/tmdb.js';

const jsonResponse = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

function provider(fetchImpl: typeof fetch, apiKey = 'k'.repeat(32)) {
  return tmdbProvider({ apiKey, fetchImpl });
}

describe('tmdbProvider.search', () => {
  it('maps results, derives the year and drops unsafe poster paths', async () => {
    const fetchImpl = vi.fn(() =>
      jsonResponse({
        results: [
          { id: 1, title: 'Metropolis', release_date: '1927-01-10', poster_path: '/abc_DEF-1.jpg' },
          { id: 2, title: 'No date', release_date: '', poster_path: null },
          { id: 3, title: 'Evil', release_date: '2000-01-01', poster_path: '/x.jpg?<script>' },
          { id: 4, title: 'Traversal', release_date: '2000-01-01', poster_path: '/../../etc.jpg' },
        ],
      }),
    ) as unknown as typeof fetch;
    const res = await provider(fetchImpl).search('metropolis');
    expect(res).toEqual([
      { tmdbId: 1, title: 'Metropolis', releaseYear: 1927, posterPath: '/abc_DEF-1.jpg' },
      { tmdbId: 2, title: 'No date', releaseYear: null, posterPath: null },
      { tmdbId: 3, title: 'Evil', releaseYear: 2000, posterPath: null },
      { tmdbId: 4, title: 'Traversal', releaseYear: 2000, posterPath: null },
    ]);
  });

  it('sends the v3 key as a query parameter and excludes adult titles', async () => {
    const fetchImpl = vi.fn(() => jsonResponse({ results: [] })) as unknown as typeof fetch;
    await provider(fetchImpl, 'a'.repeat(32)).search('x y');
    const [url, init] = vi.mocked(fetchImpl).mock.calls[0]!;
    const u = new URL(String(url));
    expect(u.searchParams.get('api_key')).toBe('a'.repeat(32));
    expect(u.searchParams.get('include_adult')).toBe('false');
    expect(u.searchParams.get('query')).toBe('x y');
    expect((init!.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('sends a v4 read-access token as a bearer header, not in the URL', async () => {
    const fetchImpl = vi.fn(() => jsonResponse({ results: [] })) as unknown as typeof fetch;
    await provider(fetchImpl, 'eyJhbGciOi.token.sig').search('x');
    const [url, init] = vi.mocked(fetchImpl).mock.calls[0]!;
    expect(new URL(String(url)).searchParams.has('api_key')).toBe(false);
    expect((init!.headers as Record<string, string>).Authorization).toBe(
      'Bearer eyJhbGciOi.token.sig',
    );
  });

  it('caps results at 10', async () => {
    const results = Array.from({ length: 20 }, (_, i) => ({ id: i + 1, title: `T${i}` }));
    const fetchImpl = (() => jsonResponse({ results })) as unknown as typeof fetch;
    expect(await provider(fetchImpl).search('t')).toHaveLength(10);
  });

  it.each([401, 429, 500])('reports provider status %s as unavailable (502)', async (status) => {
    const fetchImpl = (() =>
      jsonResponse({ status_message: 'nope' }, status)) as unknown as typeof fetch;
    await expect(provider(fetchImpl).search('x')).rejects.toMatchObject({
      status: 502,
      code: 'metadata_unavailable',
    });
  });

  it('treats network failures and malformed bodies as unavailable without leaking the key', async () => {
    const key = 'secretkey'.repeat(4);
    const failing = (() =>
      Promise.reject(new TypeError(`fetch failed ${key}`))) as unknown as typeof fetch;
    const err = await provider(failing, key)
      .search('x')
      .catch((e: unknown) => e);
    expect(err).toMatchObject({ status: 502 });
    expect(JSON.stringify(err) + String((err as Error).message)).not.toContain(key);

    const malformed = (() => jsonResponse({ results: 'nope' })) as unknown as typeof fetch;
    await expect(provider(malformed).search('x')).rejects.toMatchObject({ status: 502 });
  });
});

describe('tmdbProvider.getFilm', () => {
  it('extracts the directors from credits (max 3) and the year', async () => {
    const fetchImpl = (() =>
      jsonResponse({
        id: 19,
        title: 'Metropolis',
        release_date: '1927-01-10',
        poster_path: '/p.jpg',
        credits: {
          crew: [
            { job: 'Producer', name: 'Someone' },
            { job: 'Director', name: ' Fritz Lang ' },
            { job: 'Director', name: 'Second' },
            { job: 'Director', name: 'Third' },
            { job: 'Director', name: 'Fourth' },
          ],
        },
      })) as unknown as typeof fetch;
    expect(await provider(fetchImpl).getFilm(19)).toEqual({
      tmdbId: 19,
      title: 'Metropolis',
      releaseYear: 1927,
      posterPath: '/p.jpg',
      director: 'Fritz Lang, Second, Third',
    });
  });

  it('returns a null director when no credits exist, and null for an unknown film', async () => {
    const noCredits = (() => jsonResponse({ id: 5, title: 'X' })) as unknown as typeof fetch;
    expect((await provider(noCredits).getFilm(5))?.director).toBeNull();
    const missing = (() => jsonResponse({ status_code: 34 }, 404)) as unknown as typeof fetch;
    expect(await provider(missing).getFilm(999)).toBeNull();
  });
});
