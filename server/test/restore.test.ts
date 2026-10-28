import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { bearer, buildTestApp, validEvidence, validInterpretation } from './helpers.js';

async function setup() {
  const ctx = buildTestApp();
  const film = ctx.addFilm();
  const author = ctx.addUser('author');
  const reporter = ctx.addUser('reporter');
  const mod = ctx.addUser('mod', 'moderator');
  const interp = await request(ctx.app)
    .post('/api/interpretations')
    .set(bearer(author))
    .send(validInterpretation(film.id));
  const interpretationId = interp.body.interpretation.id as string;
  const cr = await request(ctx.app)
    .post(`/api/interpretations/${interpretationId}/counter-readings`)
    .set(bearer(reporter))
    .send({ body: 'A counter.', evidence: [validEvidence] });
  const counterId = cr.body.counterReading.id as string;

  /** Report then moderate the interpretation with `action`. */
  const moderate = async (action: 'hide' | 'remove' | 'dismiss', targetId = interpretationId) => {
    const targetType = targetId === counterId ? 'counter_reading' : 'interpretation';
    const rep = await request(ctx.app)
      .post('/api/reports')
      .set(bearer(targetType === 'counter_reading' ? author : reporter))
      .send({ targetType, targetId, reason: 'spam' });
    await request(ctx.app)
      .post(`/api/moderation/reports/${rep.body.report.id}/resolve`)
      .set(bearer(mod))
      .send({ action });
  };
  const restore = (
    who: { id: string; username: string; role: 'user' | 'moderator' | 'admin' },
    type: string,
    id: string,
    body: unknown = {},
  ) =>
    request(ctx.app)
      .post(`/api/moderation/content/${type}/${id}/restore`)
      .set(bearer(who))
      .send(body as object);
  return { ...ctx, film, author, reporter, mod, interpretationId, counterId, moderate, restore };
}

describe('restoring moderated content', () => {
  it('requires sign-in and moderator rights', async () => {
    const { app, interpretationId, reporter, author, moderate } = await setup();
    await moderate('hide');
    const anon = await request(app).post(
      `/api/moderation/content/interpretation/${interpretationId}/restore`,
    );
    expect(anon.status).toBe(401);
    for (const who of [reporter, author]) {
      const res = await request(app)
        .post(`/api/moderation/content/interpretation/${interpretationId}/restore`)
        .set(bearer(who));
      expect(res.status).toBe(403);
    }
    // Still hidden after the failed attempts.
    expect((await request(app).get(`/api/interpretations/${interpretationId}`)).status).toBe(404);
  });

  it.each(['hide', 'remove'] as const)(
    'brings %s-ed interpretations back to the public API and audits it',
    async (action) => {
      const { app, mod, interpretationId, moderate, restore, auditLog } = await setup();
      await moderate(action);
      expect((await request(app).get(`/api/interpretations/${interpretationId}`)).status).toBe(404);
      const res = await restore(mod, 'interpretation', interpretationId, { note: 'appeal upheld' });
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ restored: true });
      expect((await request(app).get(`/api/interpretations/${interpretationId}`)).status).toBe(200);
      expect(auditLog.at(-1)).toMatchObject({
        moderatorId: mod.id,
        action: 'restore',
        note: 'appeal upheld',
      });
    },
  );

  it('restores a counter-reading without touching its interpretation', async () => {
    const { app, mod, interpretationId, counterId, moderate, restore } = await setup();
    await moderate('remove', counterId);
    const hidden = await request(app).get(`/api/interpretations/${interpretationId}`);
    expect(hidden.body.interpretation.counterReadings).toHaveLength(0);
    expect((await restore(mod, 'counter_reading', counterId)).status).toBe(200);
    const back = await request(app).get(`/api/interpretations/${interpretationId}`);
    expect(back.body.interpretation.counterReadings).toHaveLength(1);
  });

  it('refuses published content and content nobody moderated (409)', async () => {
    const { app, mod, interpretationId, restore } = await setup();
    const published = await restore(mod, 'interpretation', interpretationId);
    expect(published.status).toBe(409);
    expect(published.body.error.code).toBe('not_restorable');
    // The author deleting their own work is not a moderation decision, so it cannot be undone here.
    const {
      app: app2,
      author,
      mod: mod2,
      interpretationId: id2,
      restore: restore2,
    } = await setup();
    await request(app2).delete(`/api/interpretations/${id2}`).set(bearer(author));
    expect((await restore2(mod2, 'interpretation', id2)).status).toBe(409);
    expect((await request(app2).get(`/api/interpretations/${id2}`)).status).toBe(404);
    expect(app).toBeDefined();
  });

  it('cannot be applied twice, and a dismissal does not make content restorable', async () => {
    const { mod, interpretationId, moderate, restore } = await setup();
    await moderate('hide');
    expect((await restore(mod, 'interpretation', interpretationId)).status).toBe(200);
    expect((await restore(mod, 'interpretation', interpretationId)).status).toBe(409);
  });

  it('after a restore, a later author deletion stays deleted', async () => {
    const { app, mod, author, interpretationId, moderate, restore } = await setup();
    await moderate('hide');
    await restore(mod, 'interpretation', interpretationId);
    await request(app).delete(`/api/interpretations/${interpretationId}`).set(bearer(author));
    expect((await restore(mod, 'interpretation', interpretationId)).status).toBe(409);
  });

  it('validates the path and body', async () => {
    const { mod, interpretationId, restore } = await setup();
    expect((await restore(mod, 'nonsense', interpretationId)).status).toBe(400);
    expect((await restore(mod, 'interpretation', 'not-a-uuid')).status).toBe(400);
    expect(
      (await restore(mod, 'interpretation', interpretationId, { note: 'x'.repeat(1001) })).status,
    ).toBe(400);
    expect((await restore(mod, 'interpretation', randomUUID())).status).toBe(404);
  });
});
