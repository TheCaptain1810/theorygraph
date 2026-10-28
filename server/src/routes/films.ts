import { Router } from 'express';
import type { Repository } from '../repo/types.js';
import { idParam, listQuery } from '../domain/schemas.js';
import { notFound } from '../errors.js';
import { toPublicSummary } from '../domain/spoilers.js';

const PAGE_SIZE = 20;

export function filmRoutes(repo: Repository): Router {
  const r = Router();

  r.get('/', async (req, res) => {
    const { query, page } = listQuery.parse(req.query);
    res.json(await repo.searchFilms({ query, page, pageSize: PAGE_SIZE }));
  });

  r.get('/:filmId', async (req, res) => {
    const film = await repo.getFilm(idParam.parse(req.params.filmId));
    if (!film) throw notFound('Film');
    res.json({ film });
  });

  r.get('/:filmId/interpretations', async (req, res) => {
    const filmId = idParam.parse(req.params.filmId);
    const { tag, page } = listQuery.parse(req.query);
    if (!(await repo.getFilm(filmId))) throw notFound('Film');
    const result = await repo.listPublishedInterpretations(filmId, {
      tag,
      page,
      pageSize: PAGE_SIZE,
    });
    // Spoiler gating happens here, on the server, so concealed text never reaches the client.
    res.json({ ...result, items: result.items.map(toPublicSummary) });
  });

  return r;
}
