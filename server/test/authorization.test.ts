import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { bearer, buildTestApp, validEvidence, validInterpretation } from './helpers.js';

async function setup() {
  const ctx = buildTestApp();
  const film = ctx.addFilm();
  const author = ctx.addUser('author');
  const other = ctx.addUser('other');
  const mod = ctx.addUser('mod', 'moderator');
  const res = await request(ctx.app)
    .post('/api/interpretations')
    .set(bearer(author))
    .send(validInterpretation(film.id));
  return { ...ctx, film, author, other, mod, id: res.body.interpretation.id as string };
}

describe('authentication', () => {
  it('rejects writes without a token (401, consistent error shape)', async () => {
    const { app, film } = await setup();
    const res = await request(app).post('/api/interpretations').send(validInterpretation(film.id));
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: 'unauthenticated', message: expect.any(String) } });
  });

  it('rejects invalid tokens', async () => {
    const { app, film } = await setup();
    const res = await request(app)
      .post('/api/interpretations')
      .set('Authorization', 'Bearer garbage')
      .send(validInterpretation(film.id));
    expect(res.status).toBe(401);
  });

  it('public reads work without login', async () => {
    const { app, film, id } = await setup();
    expect((await request(app).get('/api/health')).body).toEqual({ status: 'ok' });
    expect((await request(app).get('/api/films')).status).toBe(200);
    expect((await request(app).get(`/api/films/${film.id}`)).status).toBe(200);
    expect((await request(app).get(`/api/interpretations/${id}`)).status).toBe(200);
  });
});

describe('authorization (server-side)', () => {
  it('ignores a client-supplied authorId and uses the verified identity', async () => {
    const { app, film, other, author } = await setup();
    const res = await request(app)
      .post('/api/interpretations')
      .set(bearer(other))
      .send({ ...validInterpretation(film.id), authorId: author.id });
    expect(res.status).toBe(201);
    expect(res.body.interpretation.author.username).toBe('other');
  });

  it('lets authors edit their own interpretation', async () => {
    const { app, author, id } = await setup();
    const res = await request(app)
      .patch(`/api/interpretations/${id}`)
      .set(bearer(author))
      .send({ title: 'Revised' });
    expect(res.status).toBe(200);
    expect(res.body.interpretation.title).toBe('Revised');
  });

  it('forbids editing someone else’s interpretation (403)', async () => {
    const { app, other, id } = await setup();
    const res = await request(app)
      .patch(`/api/interpretations/${id}`)
      .set(bearer(other))
      .send({ title: 'Hijack' });
    expect(res.status).toBe(403);
  });

  it('moderators can remove but do NOT gain edit rights', async () => {
    const { app, mod, id } = await setup();
    const edit = await request(app)
      .patch(`/api/interpretations/${id}`)
      .set(bearer(mod))
      .send({ title: 'x' });
    expect(edit.status).toBe(403);
    const del = await request(app).delete(`/api/interpretations/${id}`).set(bearer(mod));
    expect(del.status).toBe(204);
  });

  it('forbids ordinary users removing others’ content; authors may soft-remove their own', async () => {
    const { app, other, author, id } = await setup();
    expect(
      (await request(app).delete(`/api/interpretations/${id}`).set(bearer(other))).status,
    ).toBe(403);
    expect(
      (await request(app).delete(`/api/interpretations/${id}`).set(bearer(author))).status,
    ).toBe(204);
  });

  it('role comes from the database, not from anything the client sends', async () => {
    const { app, other, id } = await setup();
    const res = await request(app)
      .delete(`/api/interpretations/${id}`)
      .set(bearer(other))
      .set('X-Role', 'admin')
      .send({ role: 'admin' });
    expect(res.status).toBe(403);
  });
});

describe('hidden/removed content is never public', () => {
  for (const status of ['hidden', 'removed'] as const) {
    it(`${status} interpretations are absent from detail and list`, async () => {
      const { app, film, id, setStatus } = await setup();
      setStatus(id, status);
      expect((await request(app).get(`/api/interpretations/${id}`)).status).toBe(404);
      const list = await request(app).get(`/api/films/${film.id}/interpretations`);
      expect(list.body.items).toHaveLength(0);
    });
  }

  it('hidden counter-readings are omitted from the public interpretation', async () => {
    const { app, other, id, setCounterStatus } = await setup();
    const cr = await request(app)
      .post(`/api/interpretations/${id}/counter-readings`)
      .set(bearer(other))
      .send({ body: 'An abusive reply' });
    setCounterStatus(cr.body.counterReading.id, 'hidden');
    const res = await request(app).get(`/api/interpretations/${id}`);
    expect(res.body.interpretation.counterReadings).toHaveLength(0);
  });

  it('cannot add counter-readings or evidence to non-published content', async () => {
    const { app, author, other, id, setStatus } = await setup();
    setStatus(id, 'hidden');
    expect(
      (
        await request(app)
          .post(`/api/interpretations/${id}/counter-readings`)
          .set(bearer(other))
          .send({ body: 'x' })
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .post(`/api/interpretations/${id}/evidence`)
          .set(bearer(author))
          .send(validEvidence)
      ).status,
    ).toBe(404);
  });
});

describe('rate limiting', () => {
  it('limits write endpoints per client (429)', async () => {
    const ctx = buildTestApp({ writeLimitPerMinute: 2 });
    const film = ctx.addFilm();
    const u = ctx.addUser('spammer');
    const send = () =>
      request(ctx.app)
        .post('/api/interpretations')
        .set(bearer(u))
        .send(validInterpretation(film.id));
    expect((await send()).status).toBe(201);
    expect((await send()).status).toBe(201);
    const third = await send();
    expect(third.status).toBe(429);
    expect(third.body.error.code).toBe('rate_limited');
  });
});
