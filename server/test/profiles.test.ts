import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { bearer, buildTestApp, validEvidence, validInterpretation } from './helpers.js';

async function setup() {
  const ctx = buildTestApp();
  const film = ctx.addFilm('Profile Film');
  const author = ctx.addUser('author');
  const other = ctx.addUser('other');
  const post = (over: Record<string, unknown>) =>
    request(ctx.app)
      .post('/api/interpretations')
      .set(bearer(author))
      .send(validInterpretation(film.id, over));
  const open = (await post({ title: 'Open one', claim: 'OPEN CLAIM' })).body.interpretation;
  const secret = (
    await post({ title: 'SECRET TITLE', claim: 'SECRET CLAIM', spoilerLevel: 'major' })
  ).body.interpretation;
  const counter = (path: string, who = other, body = 'COUNTER BODY') =>
    request(ctx.app)
      .post(`/api/interpretations/${path}/counter-readings`)
      .set(bearer(who))
      .send({ body, evidence: [validEvidence] });
  return { ...ctx, film, author, other, open, secret, counter };
}

describe('GET /api/users/:username', () => {
  it('is public and lists published interpretations with the film title', async () => {
    const { app, open } = await setup();
    const res = await request(app).get('/api/users/author');
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('author');
    expect(res.body.interpretations.total).toBe(2);
    const item = res.body.interpretations.items.find((i: { id: string }) => i.id === open.id);
    expect(item).toMatchObject({ concealed: false, title: 'Open one', filmTitle: 'Profile Film' });
  });

  it('conceals major-spoiler interpretations: no title or claim anywhere in the response', async () => {
    const { app } = await setup();
    const res = await request(app).get('/api/users/author');
    expect(res.body.interpretations.items.some((i: { concealed: boolean }) => i.concealed)).toBe(
      true,
    );
    const text = JSON.stringify(res.body);
    expect(text).not.toContain('SECRET TITLE');
    expect(text).not.toContain('SECRET CLAIM');
  });

  it('never exposes email, role or internal ids of the user', async () => {
    const { app, mod } = await setup().then((c) => ({ ...c, mod: c.addUser('mod', 'moderator') }));
    const res = await request(app).get(`/api/users/${mod.username}`);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.user).sort()).toEqual([
      'bio',
      'displayName',
      'joinedAt',
      'username',
    ]);
  });

  it('shows counter-readings with an excerpt, but conceals them under a major-spoiler parent', async () => {
    const { app, open, secret, counter } = await setup();
    await counter(open.id, undefined, 'VISIBLE COUNTER');
    await counter(secret.id, undefined, 'HIDDEN COUNTER');
    const res = await request(app).get('/api/users/other');
    expect(res.body.counterReadings.total).toBe(2);
    const text = JSON.stringify(res.body);
    expect(text).toContain('VISIBLE COUNTER');
    expect(text).not.toContain('HIDDEN COUNTER');
    expect(
      res.body.counterReadings.items.filter((c: { concealed: boolean }) => c.concealed),
    ).toHaveLength(1);
  });

  it('omits hidden/removed interpretations and counter-readings on or under them', async () => {
    const { app, open, secret, counter, setStatus, author } = await setup();
    const c = await counter(open.id);
    expect(c.status).toBe(201);
    setStatus(open.id, 'hidden');
    setStatus(secret.id, 'removed');
    const mine = await request(app).get('/api/users/author');
    expect(mine.body.interpretations.total).toBe(0);
    expect(mine.body.interpretations.items).toEqual([]);
    // The counter-reading's parent is hidden, so it disappears from the commenter's profile too.
    const theirs = await request(app).get('/api/users/other');
    expect(theirs.body.counterReadings.total).toBe(0);
    expect(author.username).toBe('author');
  });

  it('paginates interpretations', async () => {
    const { app, film, author } = await setup();
    for (let n = 0; n < 21; n++) {
      await request(app)
        .post('/api/interpretations')
        .set(bearer(author))
        .send(validInterpretation(film.id, { title: `T${n}` }));
    }
    const p2 = await request(app).get('/api/users/author?page=2');
    expect(p2.body.interpretations.page).toBe(2);
    expect(p2.body.interpretations.total).toBe(23);
    expect(p2.body.interpretations.items).toHaveLength(3);
  });

  it('returns 404 for unknown users and 400 for malformed usernames', async () => {
    const { app } = await setup();
    expect((await request(app).get('/api/users/nobody_here')).status).toBe(404);
    expect((await request(app).get('/api/users/a')).status).toBe(400);
    expect((await request(app).get('/api/users/bad name!')).status).toBe(400);
  });

  it('is case-insensitive on the username', async () => {
    const { app } = await setup();
    expect((await request(app).get('/api/users/AUTHOR')).status).toBe(200);
  });
});
