// Optional integration tests against a real, already-migrated PostgreSQL database.
//   TEST_DATABASE_URL=postgresql://... npm run test -w server
// Skipped automatically when TEST_DATABASE_URL is not set. Uses unique random data and cleans up after itself.
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createPrismaClient, createPrismaRepository } from '../src/repo/prisma.js';
import { bearer, fakeVerifier, validEvidence, validInterpretation } from './helpers.js';

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('PostgreSQL integration', () => {
  const db = createPrismaClient(url ?? 'postgresql://unused');
  const repo = createPrismaRepository(db);
  const app = createApp({
    repo,
    auth: fakeVerifier(),
    webOrigin: 'http://localhost:5173',
    writeLimitPerMinute: 1000,
  });
  const filmId = randomUUID();
  const userA = {
    id: randomUUID(),
    username: `a_${randomUUID().slice(0, 8)}`,
    role: 'user' as const,
  };
  const userB = {
    id: randomUUID(),
    username: `b_${randomUUID().slice(0, 8)}`,
    role: 'user' as const,
  };
  const userM = {
    id: randomUUID(),
    username: `m_${randomUUID().slice(0, 8)}`,
    role: 'moderator' as const,
  };
  const created: string[] = [];

  beforeAll(async () => {
    await db.film.create({
      data: { id: filmId, provider: 'test', providerFilmId: filmId, title: 'Integration Film' },
    });
    // Profiles are provisioned on first authenticated request; the username hint comes from the verifier.
  });

  afterAll(async () => {
    const ids = [userA.id, userB.id, userM.id];
    await db.moderationAction.deleteMany({ where: { moderatorId: userM.id } });
    await db.report.deleteMany({ where: { reporterId: { in: ids } } });
    await db.evidence.deleteMany({
      where: {
        OR: [{ interpretation: { filmId } }, { counterReading: { interpretation: { filmId } } }],
      },
    });
    await db.counterReading.deleteMany({ where: { interpretation: { filmId } } });
    await db.interpretationTag.deleteMany({ where: { interpretation: { filmId } } });
    await db.interpretation.deleteMany({ where: { filmId } });
    await db.tag.deleteMany({ where: { name: { in: ['integration-tag'] } } });
    await db.film.delete({ where: { id: filmId } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
    void created;
  });

  it('runs the full claim → evidence → counter-reading flow through Prisma', async () => {
    const make = await request(app)
      .post('/api/interpretations')
      .set(bearer(userA))
      .send(validInterpretation(filmId, { tags: ['integration-tag'] }));
    expect(make.status).toBe(201);
    const id = make.body.interpretation.id as string;

    const cr = await request(app)
      .post(`/api/interpretations/${id}/counter-readings`)
      .set(bearer(userB))
      .send({ body: 'Alternative reading', evidence: [validEvidence] });
    expect(cr.status).toBe(201);

    const forbidden = await request(app)
      .patch(`/api/interpretations/${id}`)
      .set(bearer(userB))
      .send({ title: 'nope' });
    expect(forbidden.status).toBe(403);

    const detail = await request(app).get(`/api/interpretations/${id}`);
    expect(detail.body.interpretation.counterReadings).toHaveLength(1);
    expect(detail.body.interpretation.tags).toEqual(['integration-tag']);

    const list = await request(app).get(`/api/films/${filmId}/interpretations?tag=integration-tag`);
    expect(list.body.total).toBe(1);

    expect(
      (await request(app).delete(`/api/interpretations/${id}`).set(bearer(userA))).status,
    ).toBe(204);
    expect((await request(app).get(`/api/interpretations/${id}`)).status).toBe(404);
  });

  it('reports → moderator queue → hide, with an audit row, through Prisma', async () => {
    const make = await request(app)
      .post('/api/interpretations')
      .set(bearer(userA))
      .send(validInterpretation(filmId));
    const id = make.body.interpretation.id as string;

    const first = await request(app)
      .post('/api/reports')
      .set(bearer(userB))
      .send({ targetType: 'interpretation', targetId: id, reason: 'spam' });
    expect(first.status).toBe(201);
    const again = await request(app)
      .post('/api/reports')
      .set(bearer(userB))
      .send({ targetType: 'interpretation', targetId: id, reason: 'abuse' });
    expect(again.status).toBe(200); // unique (reporter, target) keeps it idempotent
    expect(await db.report.count({ where: { targetId: id } })).toBe(1);

    // Role comes from the database: provision the profile, then promote it.
    await repo.ensureUser({ id: userM.id, usernameHint: userM.username });
    await db.user.update({ where: { id: userM.id }, data: { role: 'moderator' } });

    const denied = await request(app).get('/api/moderation/reports').set(bearer(userB));
    expect(denied.status).toBe(403);

    const queue = await request(app).get('/api/moderation/reports').set(bearer(userM));
    expect(queue.status).toBe(200);
    const item = (queue.body.items as { id: string; targetId: string }[]).find(
      (r) => r.targetId === id,
    );
    expect(item).toBeDefined();

    const resolved = await request(app)
      .post(`/api/moderation/reports/${item!.id}/resolve`)
      .set(bearer(userM))
      .send({ action: 'hide', note: 'integration' });
    expect(resolved.status).toBe(200);
    expect(resolved.body.report.target.status).toBe('hidden');
    expect((await request(app).get(`/api/interpretations/${id}`)).status).toBe(404);
    expect(await db.moderationAction.count({ where: { targetId: id, action: 'hide' } })).toBe(1);
    expect(
      (
        await request(app)
          .post(`/api/moderation/reports/${item!.id}/resolve`)
          .set(bearer(userM))
          .send({ action: 'dismiss' })
      ).status,
    ).toBe(404);
  });

  it('film import is idempotent on (provider, providerFilmId) through Prisma', async () => {
    const providerFilmId = `it-${randomUUID()}`;
    const input = {
      provider: 'tmdb-test',
      providerFilmId,
      title: 'Imported',
      releaseYear: 2001,
      director: 'Someone',
      posterPath: '/p.jpg',
      metadataAttribution: 'TMDB (The Movie Database)',
    };
    try {
      const first = await repo.createFilmIfMissing(input);
      const second = await repo.createFilmIfMissing({ ...input, title: 'Changed later' });
      expect(first.created).toBe(true);
      expect(second.created).toBe(false);
      expect(second.film.id).toBe(first.film.id);
      expect(second.film.title).toBe('Imported'); // existing record wins
      expect(await repo.findFilmIdsByProvider('tmdb-test', [providerFilmId, 'missing'])).toEqual({
        [providerFilmId]: first.film.id,
      });
      expect(await repo.findFilmIdsByProvider('tmdb-test', [])).toEqual({});
      // Concurrent imports of the same film resolve to one row.
      const racing = `it-race-${randomUUID()}`;
      const results = await Promise.all(
        [1, 2, 3].map(() => repo.createFilmIfMissing({ ...input, providerFilmId: racing })),
      );
      expect(new Set(results.map((r) => r.film.id)).size).toBe(1);
      expect(results.filter((r) => r.created)).toHaveLength(1);
    } finally {
      await db.film.deleteMany({ where: { provider: 'tmdb-test' } });
    }
  });

  it('restore brings back moderator-hidden content only, through Prisma', async () => {
    await repo.ensureUser({ id: userM.id, usernameHint: userM.username });
    await db.user.update({ where: { id: userM.id }, data: { role: 'moderator' } });
    const make = await request(app)
      .post('/api/interpretations')
      .set(bearer(userA))
      .send(validInterpretation(filmId, { title: 'Restore me' }));
    const id = make.body.interpretation.id as string;
    const rep = await request(app)
      .post('/api/reports')
      .set(bearer(userB))
      .send({ targetType: 'interpretation', targetId: id, reason: 'spam' });
    await request(app)
      .post(`/api/moderation/reports/${rep.body.report.id}/resolve`)
      .set(bearer(userM))
      .send({ action: 'hide' });
    expect((await request(app).get(`/api/interpretations/${id}`)).status).toBe(404);

    const url = `/api/moderation/content/interpretation/${id}/restore`;
    expect((await request(app).post(url).set(bearer(userB))).status).toBe(403);
    expect((await request(app).post(url).set(bearer(userM)).send({ note: 'ok' })).status).toBe(200);
    expect((await request(app).get(`/api/interpretations/${id}`)).status).toBe(200);
    expect(await db.moderationAction.count({ where: { targetId: id, action: 'restore' } })).toBe(1);
    expect((await request(app).post(url).set(bearer(userM))).status).toBe(409);

    // An author's own deletion after a restore is not undoable by a moderator.
    await request(app).delete(`/api/interpretations/${id}`).set(bearer(userA));
    expect((await request(app).post(url).set(bearer(userM))).status).toBe(409);
  });

  it('public profile lists published content only, with spoiler gating, through Prisma', async () => {
    const mk = (over: Record<string, unknown>) =>
      request(app)
        .post('/api/interpretations')
        .set(bearer(userA))
        .send(validInterpretation(filmId, over));
    const open = (await mk({ title: 'Profile open' })).body.interpretation.id as string;
    const secret = await mk({
      title: 'PROFILE SECRET',
      claim: 'PROFILE SECRET CLAIM',
      spoilerLevel: 'major',
    });
    const gone = (await mk({ title: 'Profile gone' })).body.interpretation.id as string;
    await db.interpretation.update({ where: { id: gone }, data: { status: 'hidden' } });
    await request(app)
      .post(`/api/interpretations/${open}/counter-readings`)
      .set(bearer(userA))
      .send({ body: 'My own counter', evidence: [] });

    const stored = await db.user.findUniqueOrThrow({ where: { id: userA.id } });
    const res = await request(app).get(`/api/users/${stored.username}`);
    expect(res.status).toBe(200);
    const items = res.body.interpretations.items as { id: string; concealed: boolean }[];
    expect(items.some((i) => i.id === open && !i.concealed)).toBe(true);
    expect(items.some((i) => i.id === secret.body.interpretation.id && i.concealed)).toBe(true);
    expect(items.some((i) => i.id === gone)).toBe(false);
    expect(JSON.stringify(res.body)).not.toContain('PROFILE SECRET');
    expect(res.body.counterReadings.total).toBeGreaterThanOrEqual(1);
    expect((await request(app).get('/api/users/does_not_exist_xyz')).status).toBe(404);
  });

  describe('database CHECK constraints', () => {
    const rawEvidence = (data: Record<string, unknown>) =>
      db.$executeRawUnsafe(
        `INSERT INTO evidence (id, interpretation_id, counter_reading_id, evidence_type, description, timestamp_seconds)
         VALUES ($1::uuid, $2::uuid, $3::uuid, 'observation', 'x', $4)`,
        randomUUID(),
        data.interpretationId ?? null,
        data.counterReadingId ?? null,
        data.timestampSeconds ?? null,
      );

    it('rejects evidence with no parent', async () => {
      await expect(rawEvidence({})).rejects.toThrow(/evidence_exactly_one_parent_chk/);
    });

    it('rejects evidence with two parents', async () => {
      const i = await repo.createInterpretation({
        filmId,
        authorId: (await repo.ensureUser({ id: userA.id, usernameHint: userA.username })).id,
        title: 't',
        claim: 'c',
        interpretationType: 'interpretation',
        spoilerLevel: 'none',
        evidence: [validEvidence],
        tags: [],
      });
      const c = await repo.createCounterReading({
        interpretationId: i.id,
        authorId: userA.id,
        body: 'b',
        evidence: [],
      });
      await expect(rawEvidence({ interpretationId: i.id, counterReadingId: c.id })).rejects.toThrow(
        /evidence_exactly_one_parent_chk/,
      );
      await expect(rawEvidence({ interpretationId: i.id, timestampSeconds: -5 })).rejects.toThrow(
        /evidence_timestamp_non_negative_chk/,
      );
    });
  });
});
