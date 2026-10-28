import { Router } from 'express';
import type { Repository } from '../repo/types.js';
import { profileQuery, usernameParam } from '../domain/schemas.js';
import {
  toPublicProfileCounterReading,
  toPublicProfileInterpretation,
} from '../domain/spoilers.js';
import { notFound } from '../errors.js';

const PAGE_SIZE = 20;
const COUNTER_READING_LIMIT = 20;

export function userRoutes(repo: Repository): Router {
  const r = Router();

  // Public contribution history. Only published content; spoiler gating is applied server-side.
  r.get('/:username', async (req, res) => {
    const username = usernameParam.parse(req.params.username);
    const { page } = profileQuery.parse(req.query);
    const profile = await repo.getUserProfile(username);
    if (!profile) throw notFound('User');
    const [interpretations, counterReadings] = await Promise.all([
      repo.listUserInterpretations(profile.id, { page, pageSize: PAGE_SIZE }),
      repo.listUserCounterReadings(profile.id, { limit: COUNTER_READING_LIMIT }),
    ]);
    res.json({
      user: {
        username: profile.username,
        displayName: profile.displayName,
        bio: profile.bio,
        joinedAt: profile.joinedAt,
      },
      interpretations: {
        ...interpretations,
        items: interpretations.items.map(toPublicProfileInterpretation),
      },
      counterReadings: {
        total: counterReadings.total,
        items: counterReadings.items.map(toPublicProfileCounterReading),
      },
    });
  });

  return r;
}
