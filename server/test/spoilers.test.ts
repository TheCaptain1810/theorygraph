import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { toPublicSummary } from '../src/domain/spoilers.js';
import { bearer, buildTestApp, validInterpretation } from './helpers.js';

const SECRET_TITLE = 'The twist is that the narrator is dead';
const SECRET_CLAIM = 'Everything after the bridge is the narrator’s afterlife.';

async function setup(spoilerLevel: 'none' | 'minor' | 'major') {
  const ctx = buildTestApp();
  const film = ctx.addFilm();
  const author = ctx.addUser('author');
  const created = await request(ctx.app)
    .post('/api/interpretations')
    .set(bearer(author))
    .send(
      validInterpretation(film.id, {
        title: SECRET_TITLE,
        claim: SECRET_CLAIM,
        spoilerLevel,
        tags: ['afterlife'],
      }),
    );
  expect(created.status).toBe(201);
  return { ...ctx, film, id: created.body.interpretation.id as string };
}

describe('spoiler gating (server-side)', () => {
  it('conceals major spoilers in film list previews: no title, claim or tags are sent', async () => {
    const { app, film } = await setup('major');
    const res = await request(app).get(`/api/films/${film.id}/interpretations`);
    expect(res.status).toBe(200);
    const [item] = res.body.items;
    expect(item.concealed).toBe(true);
    expect(item.spoilerLevel).toBe('major');
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain(SECRET_TITLE);
    expect(raw).not.toContain(SECRET_CLAIM);
    expect(raw).not.toContain('afterlife');
  });

  it('conceals major spoilers on the detail endpoint until reveal=true', async () => {
    const { app, id } = await setup('major');
    const hidden = await request(app).get(`/api/interpretations/${id}`);
    expect(hidden.status).toBe(200);
    expect(hidden.body.interpretation.concealed).toBe(true);
    expect(JSON.stringify(hidden.body)).not.toContain(SECRET_CLAIM);

    const revealed = await request(app).get(`/api/interpretations/${id}?reveal=true`);
    expect(revealed.body.interpretation.concealed).toBe(false);
    expect(revealed.body.interpretation.claim).toBe(SECRET_CLAIM);
  });

  it('does not conceal none/minor, but still labels the spoiler level in the payload', async () => {
    for (const level of ['none', 'minor'] as const) {
      const { app, id } = await setup(level);
      const res = await request(app).get(`/api/interpretations/${id}`);
      expect(res.body.interpretation.concealed).toBe(false);
      expect(res.body.interpretation.spoilerLevel).toBe(level);
    }
  });

  it('conceals counter-readings of a major-spoiler interpretation too', async () => {
    const { app, id, addUser } = await setup('major');
    const reader = addUser('reader');
    const cr = await request(app)
      .post(`/api/interpretations/${id}/counter-readings`)
      .set(bearer(reader))
      .send({ body: 'Counter: the ending is literal, not an afterlife.' });
    expect(cr.status).toBe(201);

    const hidden = await request(app).get(`/api/interpretations/${id}`);
    expect(JSON.stringify(hidden.body)).not.toContain('Counter: the ending is literal');
    expect(hidden.body.interpretation.counterReadingCount).toBe(1);
  });

  it('toPublicSummary strips text for concealed items', () => {
    const out = toPublicSummary({
      id: 'x',
      filmId: 'f',
      author: { username: 'a', displayName: null },
      title: 'T',
      claim: 'C',
      interpretationType: 'interpretation',
      spoilerLevel: 'major',
      tags: ['t'],
      evidenceCount: 1,
      counterReadingCount: 0,
      createdAt: new Date(),
    });
    expect(out).not.toHaveProperty('title');
    expect(out).not.toHaveProperty('claim');
    expect(out).not.toHaveProperty('tags');
  });
});
