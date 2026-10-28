import { Router } from 'express';
import { z } from 'zod';
import type { RequestHandler } from 'express';
import type { Repository } from '../repo/types.js';
import {
  createReportInput,
  idParam,
  reportListQuery,
  resolveReportInput,
  restoreInput,
} from '../domain/schemas.js';
import { isModerator } from '../domain/permissions.js';
import { REPORT_TARGET_TYPES, type AppUser } from '../domain/types.js';
import { ApiError, forbidden, notFound } from '../errors.js';

const PAGE_SIZE = 20;

function currentUser(req: Parameters<RequestHandler>[0]): AppUser {
  if (!req.user) throw new ApiError(401, 'unauthenticated', 'Sign in to continue');
  return req.user;
}

/** Runs after `auth`. The role comes from the database (via ensureUser), never from the token. */
const requireModerator: RequestHandler = (req, _res, next) => {
  if (!isModerator(currentUser(req))) throw forbidden('Moderator access is required');
  next();
};

export function reportRoutes(
  repo: Repository,
  auth: RequestHandler,
  writeLimiter: RequestHandler,
): Router {
  const r = Router();

  r.post('/', writeLimiter, auth, async (req, res) => {
    const user = currentUser(req);
    const input = createReportInput.parse(req.body);

    // The target must exist and be public. Reporting hidden/removed content would leak its existence.
    const target =
      input.targetType === 'interpretation'
        ? await repo.getInterpretationOwnership(input.targetId)
        : await repo.getCounterReadingOwnership(input.targetId);
    if (!target || target.status !== 'published') throw notFound('Content');
    if (target.authorId === user.id) {
      throw new ApiError(400, 'invalid_report', 'You cannot report your own content');
    }

    const { id, created } = await repo.createReport({
      reporterId: user.id,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      details: input.details,
    });
    // Repeats are idempotent: the reporter gets the same answer without a duplicate row.
    res.status(created ? 201 : 200).json({ report: { id, alreadyReported: !created } });
  });

  return r;
}

export function moderationRoutes(
  repo: Repository,
  auth: RequestHandler,
  writeLimiter: RequestHandler,
): Router {
  const r = Router();
  r.use(auth, requireModerator);

  r.get('/reports', async (req, res) => {
    const { status, page } = reportListQuery.parse(req.query);
    res.json(await repo.listReports({ status, page, pageSize: PAGE_SIZE }));
  });

  r.post('/reports/:id/resolve', writeLimiter, async (req, res) => {
    const moderator = currentUser(req);
    const reportId = idParam.parse(req.params.id);
    const input = resolveReportInput.parse(req.body);
    const resolved = await repo.resolveReport({
      reportId,
      moderatorId: moderator.id,
      action: input.action,
      note: input.note,
    });
    if (!resolved) throw notFound('Open report');
    res.json({ report: resolved });
  });

  // Undo a moderator's hide/remove. Author self-deletions are not restorable here.
  r.post('/content/:targetType/:targetId/restore', writeLimiter, async (req, res) => {
    const moderator = currentUser(req);
    const targetType = z.enum(REPORT_TARGET_TYPES).parse(req.params.targetType);
    const targetId = idParam.parse(req.params.targetId);
    const { note } = restoreInput.parse(req.body ?? {});
    const outcome = await repo.restoreContent({
      targetType,
      targetId,
      moderatorId: moderator.id,
      note,
    });
    if (outcome === 'not_found') throw notFound('Content');
    if (outcome === 'not_restorable') {
      throw new ApiError(
        409,
        'not_restorable',
        'Only content that a moderator hid or removed can be restored.',
      );
    }
    res.json({ restored: true });
  });

  return r;
}
