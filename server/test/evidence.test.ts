import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { bearer, buildTestApp, validEvidence, validInterpretation } from './helpers.js';

async function setup() {
  const ctx = buildTestApp();
  const film = ctx.addFilm();
  const author = ctx.addUser('author');
  const other = ctx.addUser('other');
  const post = (body: unknown, as = author) =>
    request(ctx.app)
      .post('/api/interpretations')
      .set(bearer(as))
      .send(body as object);
  return { ...ctx, film, author, other, post };
}

describe('create interpretation validation', () => {
  it('creates a valid interpretation with a stable id', async () => {
    const { post, film } = await setup();
    const res = await post(validInterpretation(film.id));
    expect(res.status).toBe(201);
    expect(res.body.interpretation.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('requires at least one evidence item', async () => {
    const { post, film } = await setup();
    const res = await post(validInterpretation(film.id, { evidence: [] }));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
  });

  it('requires an observation or scene reference (a lone external source is not enough)', async () => {
    const { post, film } = await setup();
    const res = await post(
      validInterpretation(film.id, {
        evidence: [
          {
            evidenceType: 'external_source',
            description: 'An essay',
            sourceUrl: 'https://example.com/essay',
          },
        ],
      }),
    );
    expect(res.status).toBe(400);
  });

  it('accepts an external source alongside a scene reference', async () => {
    const { post, film } = await setup();
    const res = await post(
      validInterpretation(film.id, {
        evidence: [
          {
            evidenceType: 'external_source',
            description: 'An essay',
            sourceUrl: 'https://example.com/essay',
            timestampSeconds: 120,
          },
        ],
      }),
    );
    expect(res.status).toBe(201);
  });

  it('rejects missing title/claim and unknown enum values with useful details', async () => {
    const { post, film } = await setup();
    const res = await post(
      validInterpretation(film.id, { title: '  ', interpretationType: 'proof' }),
    );
    expect(res.status).toBe(400);
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['title', 'interpretationType']));
  });

  it('404s for an unknown film', async () => {
    const { post } = await setup();
    const res = await post(validInterpretation('11111111-1111-4111-8111-111111111111'));
    expect(res.status).toBe(404);
  });

  it('rejects malformed JSON with a consistent error', async () => {
    const { app, author } = await setup();
    const res = await request(app)
      .post('/api/interpretations')
      .set(bearer(author))
      .set('Content-Type', 'application/json')
      .send('{not json');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_json');
  });
});

describe('evidence rules', () => {
  it('rejects negative timestamps', async () => {
    const { post, film } = await setup();
    const res = await post(
      validInterpretation(film.id, { evidence: [{ ...validEvidence, timestampSeconds: -1 }] }),
    );
    expect(res.status).toBe(400);
  });

  it('rejects non-integer timestamps', async () => {
    const { post, film } = await setup();
    const res = await post(
      validInterpretation(film.id, { evidence: [{ ...validEvidence, timestampSeconds: 1.5 }] }),
    );
    expect(res.status).toBe(400);
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>1</script>',
    'ftp://example.com/x',
    'not a url',
    'https://user:pw@example.com/',
  ])('rejects unsafe or invalid link %s', async (sourceUrl) => {
    const { post, film } = await setup();
    const res = await post(
      validInterpretation(film.id, {
        evidence: [validEvidence, { evidenceType: 'external_source', description: 'x', sourceUrl }],
      }),
    );
    expect(res.status).toBe(400);
  });

  it('requires a link for external-source evidence', async () => {
    const { post, film } = await setup();
    const res = await post(
      validInterpretation(film.id, {
        evidence: [validEvidence, { evidenceType: 'external_source', description: 'no link' }],
      }),
    );
    expect(res.status).toBe(400);
  });

  it('every evidence row belongs to exactly one parent', async () => {
    const { app, post, film, author, other, evidenceParents } = await setup();
    const created = await post(validInterpretation(film.id));
    const id = created.body.interpretation.id;
    await request(app)
      .post(`/api/interpretations/${id}/evidence`)
      .set(bearer(author))
      .send(validEvidence);
    const cr = await request(app)
      .post(`/api/interpretations/${id}/counter-readings`)
      .set(bearer(other))
      .send({ body: 'Alternative', evidence: [validEvidence] });
    await request(app)
      .post(`/api/counter-readings/${cr.body.counterReading.id}/evidence`)
      .set(bearer(other))
      .send(validEvidence);

    expect(evidenceParents.length).toBe(4);
    for (const p of evidenceParents) {
      expect(
        Number(p.interpretationId !== undefined) + Number(p.counterReadingId !== undefined),
      ).toBe(1);
    }
  });

  it('only the interpretation author can add evidence to it', async () => {
    const { app, post, film, other } = await setup();
    const id = (await post(validInterpretation(film.id))).body.interpretation.id;
    const res = await request(app)
      .post(`/api/interpretations/${id}/evidence`)
      .set(bearer(other))
      .send(validEvidence);
    expect(res.status).toBe(403);
  });

  it('only the counter-reading author can add evidence to it', async () => {
    const { app, post, film, author, other } = await setup();
    const id = (await post(validInterpretation(film.id))).body.interpretation.id;
    const cr = await request(app)
      .post(`/api/interpretations/${id}/counter-readings`)
      .set(bearer(other))
      .send({ body: 'Alt' });
    const crId = cr.body.counterReading.id;
    expect(
      (
        await request(app)
          .post(`/api/counter-readings/${crId}/evidence`)
          .set(bearer(author))
          .send(validEvidence)
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post(`/api/counter-readings/${crId}/evidence`)
          .set(bearer(other))
          .send(validEvidence)
      ).status,
    ).toBe(201);
  });
});

describe('counter-readings', () => {
  it('keeps the original visible and attaches independent evidence', async () => {
    const { app, post, film, other } = await setup();
    const id = (await post(validInterpretation(film.id))).body.interpretation.id;
    const cr = await request(app)
      .post(`/api/interpretations/${id}/counter-readings`)
      .set(bearer(other))
      .send({
        body: 'I read it differently.',
        evidence: [{ ...validEvidence, description: 'A different detail' }],
      });
    expect(cr.status).toBe(201);

    const res = await request(app).get(`/api/interpretations/${id}`);
    const i = res.body.interpretation;
    expect(i.claim).toBe('The symmetry signals imposed order.');
    expect(i.evidence).toHaveLength(1);
    expect(i.counterReadings).toHaveLength(1);
    expect(i.counterReadings[0].evidence[0].description).toBe('A different detail');
  });

  it('requires sign-in and a non-empty body', async () => {
    const { app, post, film, other } = await setup();
    const id = (await post(validInterpretation(film.id))).body.interpretation.id;
    expect(
      (await request(app).post(`/api/interpretations/${id}/counter-readings`).send({ body: 'x' }))
        .status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .post(`/api/interpretations/${id}/counter-readings`)
          .set(bearer(other))
          .send({ body: ' ' })
      ).status,
    ).toBe(400);
  });
});

describe('film endpoints', () => {
  it('returns 400 for malformed ids and 404 for unknown films', async () => {
    const { app } = await setup();
    expect((await request(app).get('/api/films/not-a-uuid')).status).toBe(400);
    expect((await request(app).get('/api/films/11111111-1111-4111-8111-111111111111')).status).toBe(
      404,
    );
  });

  it('filters the list by tag and paginates', async () => {
    const { app, post, film } = await setup();
    await post(validInterpretation(film.id, { tags: ['symmetry'] }));
    await post(validInterpretation(film.id, { tags: ['colour'] }));
    const res = await request(app).get(`/api/films/${film.id}/interpretations?tag=symmetry`);
    expect(res.body.items).toHaveLength(1);
    expect(res.body).toMatchObject({ total: 1, page: 1, pageSize: 20 });
  });
});
