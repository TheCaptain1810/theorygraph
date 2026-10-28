import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { Repository } from '../repo/types.js';
import type { AppUser } from '../domain/types.js';
import {
  createCounterReadingInput,
  createInterpretationInput,
  evidenceInput,
  idParam,
  revealQuery,
  updateInterpretationInput,
} from '../domain/schemas.js';
import { canEdit, canRemove } from '../domain/permissions.js';
import { toPublicDetail } from '../domain/spoilers.js';
import { ApiError, forbidden, notFound } from '../errors.js';

function currentUser(req: Parameters<RequestHandler>[0]): AppUser {
  if (!req.user) throw new ApiError(401, 'unauthenticated', 'Sign in to continue');
  return req.user;
}

export function interpretationRoutes(
  repo: Repository,
  auth: RequestHandler,
  writeLimiter: RequestHandler,
): Router {
  const r = Router();

  // ---- Public ----
  r.get('/:id', async (req, res) => {
    const id = idParam.parse(req.params.id);
    const { reveal } = revealQuery.parse(req.query);
    const interpretation = await repo.getPublishedInterpretation(id);
    if (!interpretation) throw notFound('Interpretation');
    res.json({ interpretation: toPublicDetail(interpretation, reveal) });
  });

  // ---- Authenticated ----
  r.post('/', writeLimiter, auth, async (req, res) => {
    const user = currentUser(req);
    const input = createInterpretationInput.parse(req.body);
    if (!(await repo.getFilm(input.filmId))) throw notFound('Film');
    const created = await repo.createInterpretation({
      filmId: input.filmId,
      authorId: user.id, // never taken from the request body
      title: input.title,
      claim: input.claim,
      interpretationType: input.interpretationType,
      spoilerLevel: input.spoilerLevel,
      evidence: input.evidence,
      tags: input.tags ?? [],
    });
    res.status(201).json({ interpretation: toPublicDetail(created, true) });
  });

  r.patch('/:id', writeLimiter, auth, async (req, res) => {
    const user = currentUser(req);
    const id = idParam.parse(req.params.id);
    const patch = updateInterpretationInput.parse(req.body);
    const record = await repo.getInterpretationOwnership(id);
    if (!record || record.status !== 'published') throw notFound('Interpretation');
    if (!canEdit(user, record.authorId))
      throw forbidden('You can only edit your own interpretations');
    const updated = await repo.updateInterpretation(id, patch);
    res.json({ interpretation: toPublicDetail(updated, true) });
  });

  r.delete('/:id', writeLimiter, auth, async (req, res) => {
    const user = currentUser(req);
    const id = idParam.parse(req.params.id);
    const record = await repo.getInterpretationOwnership(id);
    if (!record || record.status === 'removed') throw notFound('Interpretation');
    if (!canRemove(user, record.authorId))
      throw forbidden('You can only remove your own interpretations');
    await repo.setInterpretationStatus(id, 'removed'); // soft removal
    res.status(204).end();
  });

  r.post('/:id/evidence', writeLimiter, auth, async (req, res) => {
    const user = currentUser(req);
    const id = idParam.parse(req.params.id);
    const input = evidenceInput.parse(req.body);
    const record = await repo.getInterpretationOwnership(id);
    if (!record || record.status !== 'published') throw notFound('Interpretation');
    if (!canEdit(user, record.authorId)) {
      throw forbidden(
        'Only the author can add evidence to an interpretation. Add a counter-reading instead.',
      );
    }
    const evidence = await repo.addEvidenceToInterpretation(id, input);
    res.status(201).json({ evidence });
  });

  r.post('/:id/counter-readings', writeLimiter, auth, async (req, res) => {
    const user = currentUser(req);
    const id = idParam.parse(req.params.id);
    const input = createCounterReadingInput.parse(req.body);
    const record = await repo.getInterpretationOwnership(id);
    if (!record || record.status !== 'published') throw notFound('Interpretation');
    const counterReading = await repo.createCounterReading({
      interpretationId: id,
      authorId: user.id,
      body: input.body,
      evidence: input.evidence ?? [],
    });
    res.status(201).json({ counterReading });
  });

  return r;
}

export function counterReadingRoutes(
  repo: Repository,
  auth: RequestHandler,
  writeLimiter: RequestHandler,
): Router {
  const r = Router();

  // Soft removal by the author, or by a moderator (explicit elevated right).
  r.delete('/:id', writeLimiter, auth, async (req, res) => {
    const user = currentUser(req);
    const id = idParam.parse(req.params.id);
    const record = await repo.getCounterReadingOwnership(id);
    if (!record || record.status === 'removed') throw notFound('Counter-reading');
    if (!canRemove(user, record.authorId)) {
      throw forbidden('You can only remove your own counter-readings');
    }
    await repo.setCounterReadingStatus(id, 'removed');
    res.status(204).end();
  });

  r.post('/:id/evidence', writeLimiter, auth, async (req, res) => {
    const user = currentUser(req);
    const id = idParam.parse(req.params.id);
    const input = evidenceInput.parse(req.body);
    const record = await repo.getCounterReadingOwnership(id);
    if (!record || record.status !== 'published') throw notFound('Counter-reading');
    const parent = await repo.getInterpretationOwnership(record.interpretationId);
    if (!parent || parent.status !== 'published') throw notFound('Counter-reading');
    if (!canEdit(user, record.authorId)) {
      throw forbidden('Only the author can add evidence to a counter-reading');
    }
    const evidence = await repo.addEvidenceToCounterReading(id, input);
    res.status(201).json({ evidence });
  });

  return r;
}
