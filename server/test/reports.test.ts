import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { bearer, buildTestApp, validEvidence, validInterpretation } from './helpers.js';

async function setup() {
  const ctx = buildTestApp();
  const film = ctx.addFilm();
  const author = ctx.addUser('author');
  const reporter = ctx.addUser('reporter');
  const other = ctx.addUser('other');
  const mod = ctx.addUser('mod', 'moderator');
  const created = await request(ctx.app)
    .post('/api/interpretations')
    .set(bearer(author))
    .send(validInterpretation(film.id));
  const interpretationId = created.body.interpretation.id as string;
  const counter = await request(ctx.app)
    .post(`/api/interpretations/${interpretationId}/counter-readings`)
    .set(bearer(other))
    .send({ body: 'A different reading.', evidence: [validEvidence] });
  const counterId = counter.body.counterReading.id as string;
  const report = (
    who: { id: string; username: string; role: 'user' | 'moderator' | 'admin' },
    over: Record<string, unknown> = {},
  ) =>
    request(ctx.app)
      .post('/api/reports')
      .set(bearer(who))
      .send({
        targetType: 'interpretation',
        targetId: interpretationId,
        reason: 'spam',
        ...over,
      });
  return { ...ctx, film, author, reporter, other, mod, interpretationId, counterId, report };
}

describe('POST /api/reports', () => {
  it('requires sign-in', async () => {
    const { app, interpretationId } = await setup();
    const res = await request(app)
      .post('/api/reports')
      .send({ targetType: 'interpretation', targetId: interpretationId, reason: 'spam' });
    expect(res.status).toBe(401);
  });

  it('creates a report for published content', async () => {
    const { report, reporter, reports } = await setup();
    const res = await report(reporter, { details: '  looks like an ad  ' });
    expect(res.status).toBe(201);
    expect(res.body.report.alreadyReported).toBe(false);
    expect(reports).toHaveLength(1);
    expect(reports[0]?.details).toBe('looks like an ad'); // trimmed
    expect(reports[0]?.reporterId).toBe(reporter.id); // from the token, not the body
  });

  it('can report a counter-reading', async () => {
    const { report, reporter, counterId } = await setup();
    const res = await report(reporter, { targetType: 'counter_reading', targetId: counterId });
    expect(res.status).toBe(201);
  });

  it('is idempotent per reporter and target', async () => {
    const { report, reporter, reports } = await setup();
    await report(reporter);
    const again = await report(reporter, { reason: 'abuse' });
    expect(again.status).toBe(200);
    expect(again.body.report.alreadyReported).toBe(true);
    expect(reports).toHaveLength(1);
  });

  it('rejects invalid input with validation details', async () => {
    const { report, reporter } = await setup();
    const bad = await report(reporter, { reason: 'because' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('validation_error');
    const badId = await report(reporter, { targetId: 'nope' });
    expect(badId.status).toBe(400);
    const longDetails = await report(reporter, { details: 'x'.repeat(1001) });
    expect(longDetails.status).toBe(400);
  });

  it('returns 404 for unknown, hidden or removed content (does not confirm it exists)', async () => {
    const { report, reporter, setStatus, interpretationId } = await setup();
    expect((await report(reporter, { targetId: randomUUID() })).status).toBe(404);
    setStatus(interpretationId, 'hidden');
    expect((await report(reporter)).status).toBe(404);
    setStatus(interpretationId, 'removed');
    expect((await report(reporter)).status).toBe(404);
  });

  it('does not let authors report their own content', async () => {
    const { report, author } = await setup();
    const res = await report(author);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_report');
  });
});

describe('moderation queue permissions', () => {
  it('requires sign-in', async () => {
    const { app } = await setup();
    expect((await request(app).get('/api/moderation/reports')).status).toBe(401);
  });

  it('is forbidden for ordinary users, including the author of the reported content', async () => {
    const { app, reporter, author, report } = await setup();
    await report(reporter);
    expect((await request(app).get('/api/moderation/reports').set(bearer(reporter))).status).toBe(
      403,
    );
    expect((await request(app).get('/api/moderation/reports').set(bearer(author))).status).toBe(
      403,
    );
  });

  it('lets moderators and admins list open reports with target context', async () => {
    const { app, reporter, mod, report, addUser } = await setup();
    await report(reporter);
    const res = await request(app).get('/api/moderation/reports').set(bearer(mod));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0]).toMatchObject({
      targetType: 'interpretation',
      reason: 'spam',
      status: 'open',
      reporter: { username: 'reporter' },
      target: { status: 'published', authorUsername: 'author' },
    });
    const admin = addUser('boss', 'admin');
    expect((await request(app).get('/api/moderation/reports').set(bearer(admin))).status).toBe(200);
  });

  it('validates the status filter', async () => {
    const { app, mod } = await setup();
    const res = await request(app).get('/api/moderation/reports?status=weird').set(bearer(mod));
    expect(res.status).toBe(400);
  });
});

describe('resolving reports', () => {
  it('forbids ordinary users from resolving', async () => {
    const { app, reporter, report } = await setup();
    const { body } = await report(reporter);
    const res = await request(app)
      .post(`/api/moderation/reports/${body.report.id}/resolve`)
      .set(bearer(reporter))
      .send({ action: 'remove' });
    expect(res.status).toBe(403);
  });

  it('hide makes the interpretation disappear from public API, and is audited', async () => {
    const { app, reporter, mod, report, interpretationId, film, auditLog } = await setup();
    const { body } = await report(reporter);
    const res = await request(app)
      .post(`/api/moderation/reports/${body.report.id}/resolve`)
      .set(bearer(mod))
      .send({ action: 'hide', note: 'off-topic ad' });
    expect(res.status).toBe(200);
    expect(res.body.report.status).toBe('actioned');
    expect(res.body.report.target.status).toBe('hidden');

    expect((await request(app).get(`/api/interpretations/${interpretationId}`)).status).toBe(404);
    const list = await request(app).get(`/api/films/${film.id}/interpretations`);
    expect(list.body.items).toHaveLength(0);
    expect(auditLog).toEqual([
      { moderatorId: mod.id, reportId: body.report.id, action: 'hide', note: 'off-topic ad' },
    ]);
  });

  it('remove on a counter-reading hides only that counter-reading', async () => {
    const { app, reporter, mod, report, interpretationId, counterId } = await setup();
    const { body } = await report(reporter, { targetType: 'counter_reading', targetId: counterId });
    await request(app)
      .post(`/api/moderation/reports/${body.report.id}/resolve`)
      .set(bearer(mod))
      .send({ action: 'remove' });
    const detail = await request(app).get(`/api/interpretations/${interpretationId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.interpretation.counterReadings).toHaveLength(0);
  });

  it('dismiss leaves content published', async () => {
    const { app, reporter, mod, report, interpretationId } = await setup();
    const { body } = await report(reporter);
    const res = await request(app)
      .post(`/api/moderation/reports/${body.report.id}/resolve`)
      .set(bearer(mod))
      .send({ action: 'dismiss' });
    expect(res.body.report.status).toBe('dismissed');
    expect((await request(app).get(`/api/interpretations/${interpretationId}`)).status).toBe(200);
  });

  it('an action settles every open report about the same content', async () => {
    const { app, reporter, other, mod, report, reports } = await setup();
    const first = await report(reporter);
    await report(other);
    await request(app)
      .post(`/api/moderation/reports/${first.body.report.id}/resolve`)
      .set(bearer(mod))
      .send({ action: 'remove' });
    expect(reports.map((r) => r.status)).toEqual(['actioned', 'actioned']);
    const open = await request(app).get('/api/moderation/reports').set(bearer(mod));
    expect(open.body.total).toBe(0);
  });

  it('cannot resolve the same report twice, and validates input', async () => {
    const { app, reporter, mod, report } = await setup();
    const { body } = await report(reporter);
    const url = `/api/moderation/reports/${body.report.id}/resolve`;
    expect((await request(app).post(url).set(bearer(mod)).send({ action: 'nuke' })).status).toBe(
      400,
    );
    expect((await request(app).post(url).set(bearer(mod)).send({ action: 'dismiss' })).status).toBe(
      200,
    );
    expect((await request(app).post(url).set(bearer(mod)).send({ action: 'remove' })).status).toBe(
      404,
    );
    const missing = await request(app)
      .post(`/api/moderation/reports/${randomUUID()}/resolve`)
      .set(bearer(mod))
      .send({ action: 'dismiss' });
    expect(missing.status).toBe(404);
  });
});

describe('GET /api/me', () => {
  it('requires sign-in and returns the stored role, not anything from the client', async () => {
    const { app, mod, reporter } = await setup();
    expect((await request(app).get('/api/me')).status).toBe(401);
    const res = await request(app).get('/api/me').set(bearer(mod));
    expect(res.body.user).toEqual({ id: mod.id, username: 'mod', role: 'moderator' });
    const plain = await request(app).get('/api/me').set(bearer(reporter)).set('X-Role', 'admin');
    expect(plain.body.user.role).toBe('user');
  });
});
