import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { bearer, buildTestApp, validEvidence, validInterpretation } from './helpers.js';

async function setup() {
  const ctx = buildTestApp();
  const film = ctx.addFilm();
  const author = ctx.addUser('author');
  const replier = ctx.addUser('replier');
  const stranger = ctx.addUser('stranger');
  const mod = ctx.addUser('mod', 'moderator');
  const interp = await request(ctx.app)
    .post('/api/interpretations')
    .set(bearer(author))
    .send(validInterpretation(film.id));
  const interpretationId = interp.body.interpretation.id as string;
  const cr = await request(ctx.app)
    .post(`/api/interpretations/${interpretationId}/counter-readings`)
    .set(bearer(replier))
    .send({ body: 'An alternative.', evidence: [validEvidence] });
  return {
    ...ctx,
    author,
    replier,
    stranger,
    mod,
    interpretationId,
    counterId: cr.body.counterReading.id as string,
  };
}

describe('DELETE /api/counter-readings/:id', () => {
  it('requires sign-in', async () => {
    const { app, counterId } = await setup();
    expect((await request(app).delete(`/api/counter-readings/${counterId}`)).status).toBe(401);
  });

  it('lets the author soft-remove it; it leaves the public interpretation', async () => {
    const { app, replier, counterId, interpretationId } = await setup();
    const res = await request(app)
      .delete(`/api/counter-readings/${counterId}`)
      .set(bearer(replier));
    expect(res.status).toBe(204);
    const detail = await request(app).get(`/api/interpretations/${interpretationId}`);
    expect(detail.body.interpretation.counterReadings).toHaveLength(0);
  });

  it('forbids other users, including the interpretation author', async () => {
    const { app, stranger, author, counterId } = await setup();
    expect(
      (await request(app).delete(`/api/counter-readings/${counterId}`).set(bearer(stranger)))
        .status,
    ).toBe(403);
    expect(
      (await request(app).delete(`/api/counter-readings/${counterId}`).set(bearer(author))).status,
    ).toBe(403);
  });

  it('lets moderators remove it', async () => {
    const { app, mod, counterId } = await setup();
    expect(
      (await request(app).delete(`/api/counter-readings/${counterId}`).set(bearer(mod))).status,
    ).toBe(204);
  });

  it('returns 404 for unknown or already removed counter-readings, 400 for bad ids', async () => {
    const { app, replier, counterId } = await setup();
    await request(app).delete(`/api/counter-readings/${counterId}`).set(bearer(replier));
    expect(
      (await request(app).delete(`/api/counter-readings/${counterId}`).set(bearer(replier))).status,
    ).toBe(404);
    expect(
      (await request(app).delete(`/api/counter-readings/${randomUUID()}`).set(bearer(replier)))
        .status,
    ).toBe(404);
    expect(
      (await request(app).delete('/api/counter-readings/nope').set(bearer(replier))).status,
    ).toBe(400);
  });
});
