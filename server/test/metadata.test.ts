import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../src/errors.js';
import type { FilmMetadata, FilmMetadataProvider } from '../src/tmdb.js';
import { bearer, buildTestApp } from './helpers.js';

const catalogue: Record<number, FilmMetadata> = {
  19: {
    tmdbId: 19,
    title: 'Metropolis',
    releaseYear: 1927,
    posterPath: '/metropolis.jpg',
    director: 'Fritz Lang',
  },
};

function fakeProvider(overrides: Partial<FilmMetadataProvider> = {}) {
  const search = vi.fn(async () =>
    Object.values(catalogue).map(({ director: _d, ...candidate }) => candidate),
  );
  const getFilm = vi.fn(async (id: number) => catalogue[id] ?? null);
  const provider: FilmMetadataProvider = { search, getFilm, ...overrides };
  return { provider, search, getFilm };
}

function setup(metadata?: FilmMetadataProvider) {
  const ctx = buildTestApp(metadata ? { metadata } : {});
  return { ...ctx, user: ctx.addUser('someone') };
}

describe('GET /api/metadata/search', () => {
  it('requires sign-in', async () => {
    const { provider, search } = fakeProvider();
    const { app } = setup(provider);
    expect((await request(app).get('/api/metadata/search?query=metro')).status).toBe(401);
    expect(search).not.toHaveBeenCalled(); // anonymous traffic never spends provider quota
  });

  it('returns candidates with attribution and marks films already in the catalogue', async () => {
    const { provider } = fakeProvider();
    const { app, user } = setup(provider);
    const first = await request(app).get('/api/metadata/search?query=metro').set(bearer(user));
    expect(first.status).toBe(200);
    expect(first.body.attribution).toBe('TMDB (The Movie Database)');
    expect(first.body.items[0]).toMatchObject({ tmdbId: 19, title: 'Metropolis', filmId: null });

    await request(app).post('/api/metadata/import').set(bearer(user)).send({ tmdbId: 19 });
    const second = await request(app).get('/api/metadata/search?query=metro').set(bearer(user));
    expect(second.body.items[0].filmId).toEqual(expect.any(String));
  });

  it('validates the query', async () => {
    const { provider, search } = fakeProvider();
    const { app, user } = setup(provider);
    for (const q of ['', 'a', ' '.repeat(5), 'x'.repeat(101)]) {
      const res = await request(app)
        .get('/api/metadata/search')
        .query({ query: q })
        .set(bearer(user));
      expect(res.status).toBe(400);
    }
    expect((await request(app).get('/api/metadata/search').set(bearer(user))).status).toBe(400);
    expect(search).not.toHaveBeenCalled();
  });

  it('returns 503 when no provider is configured, and 502 when the provider fails', async () => {
    const none = setup();
    expect(
      (await request(none.app).get('/api/metadata/search?query=metro').set(bearer(none.user)))
        .status,
    ).toBe(503);

    const { provider } = fakeProvider({
      search: async () => {
        throw new ApiError(502, 'metadata_unavailable', 'Film search is temporarily unavailable');
      },
    });
    const { app, user } = setup(provider);
    const res = await request(app).get('/api/metadata/search?query=metro').set(bearer(user));
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('metadata_unavailable');
  });
});

describe('POST /api/metadata/import', () => {
  it('requires sign-in', async () => {
    const { provider, getFilm } = fakeProvider();
    const { app } = setup(provider);
    expect((await request(app).post('/api/metadata/import').send({ tmdbId: 19 })).status).toBe(401);
    expect(getFilm).not.toHaveBeenCalled();
  });

  it('stores server-fetched metadata and ignores anything the client supplies', async () => {
    const { provider } = fakeProvider();
    const { app, user } = setup(provider);
    const res = await request(app)
      .post('/api/metadata/import')
      .set(bearer(user))
      .send({ tmdbId: 19, title: 'HACKED', posterPath: '/evil.jpg', director: 'Mallory' });
    expect(res.status).toBe(201);
    expect(res.body.created).toBe(true);
    expect(res.body.film).toMatchObject({
      title: 'Metropolis',
      releaseYear: 1927,
      director: 'Fritz Lang',
      posterPath: '/metropolis.jpg',
      metadataAttribution: 'TMDB (The Movie Database)',
    });
    // The new film is a normal catalogue entry.
    const fetched = await request(app).get(`/api/films/${res.body.film.id}`);
    expect(fetched.body.film.title).toBe('Metropolis');
  });

  it('is idempotent: a repeat returns the same film without asking the provider again', async () => {
    const { provider, getFilm } = fakeProvider();
    const { app, user } = setup(provider);
    const first = await request(app)
      .post('/api/metadata/import')
      .set(bearer(user))
      .send({ tmdbId: 19 });
    const again = await request(app)
      .post('/api/metadata/import')
      .set(bearer(user))
      .send({ tmdbId: 19 });
    expect(again.status).toBe(200);
    expect(again.body.created).toBe(false);
    expect(again.body.film.id).toBe(first.body.film.id);
    expect(getFilm).toHaveBeenCalledTimes(1);
  });

  it('returns 404 for a film the provider does not know, 400 for a bad id', async () => {
    const { provider } = fakeProvider();
    const { app, user } = setup(provider);
    expect(
      (await request(app).post('/api/metadata/import').set(bearer(user)).send({ tmdbId: 1234 }))
        .status,
    ).toBe(404);
    for (const bad of [{}, { tmdbId: '19' }, { tmdbId: -1 }, { tmdbId: 1.5 }, { tmdbId: 1e12 }]) {
      const res = await request(app).post('/api/metadata/import').set(bearer(user)).send(bad);
      expect(res.status).toBe(400);
    }
  });

  it('returns 503 without a provider and 502 when the provider is down', async () => {
    const none = setup();
    expect(
      (
        await request(none.app)
          .post('/api/metadata/import')
          .set(bearer(none.user))
          .send({ tmdbId: 19 })
      ).status,
    ).toBe(503);
    const { provider } = fakeProvider({
      getFilm: async () => {
        throw new ApiError(502, 'metadata_unavailable', 'Film search is temporarily unavailable');
      },
    });
    const { app, user } = setup(provider);
    expect(
      (await request(app).post('/api/metadata/import').set(bearer(user)).send({ tmdbId: 19 }))
        .status,
    ).toBe(502);
  });
});
