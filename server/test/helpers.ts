import { randomUUID } from 'node:crypto';
import { sanitizeUsername, type AuthVerifier } from '../src/auth.js';
import { createApp } from '../src/app.js';
import type {
  AppUser,
  CounterReading,
  Evidence,
  Film,
  Interpretation,
  ModerationReport,
  NewEvidence,
  UserRole,
} from '../src/domain/types.js';
import type { Repository } from '../src/repo/types.js';
import type { FilmMetadataProvider } from '../src/tmdb.js';

/**
 * In-memory Repository mirroring the Prisma repository's visibility rules, so API behaviour
 * (authorization, spoiler gating, evidence parents) is tested without a database.
 * Database-level constraints (CHECKs, FKs) are covered by the optional integration test.
 */
export function createMemoryRepo() {
  const films = new Map<string, Film>();
  const users = new Map<string, AppUser>();
  const interps = new Map<string, Interpretation>();
  const counters = new Map<
    string,
    CounterReading & { status: 'published' | 'hidden' | 'removed' }
  >();
  const reports: (Omit<ModerationReport, 'target' | 'reporter'> & { reporterId: string })[] = [];
  const auditLog: { moderatorId: string; reportId: string; action: string; note?: string }[] = [];
  // Ordered moderation decisions per target; restore eligibility depends on the latest one.
  const actions: { targetType: string; targetId: string; action: string }[] = [];
  const evidenceParents: {
    evidenceId: string;
    interpretationId?: string;
    counterReadingId?: string;
  }[] = [];

  const mkEvidence = (e: NewEvidence): Evidence => ({
    id: randomUUID(),
    evidenceType: e.evidenceType,
    description: e.description,
    sceneDescription: e.sceneDescription ?? null,
    timestampSeconds: e.timestampSeconds ?? null,
    sourceUrl: e.sourceUrl ?? null,
    createdAt: new Date(),
  });
  const authorOf = (id: string) => {
    const u = users.get(id);
    return { username: u?.username ?? 'unknown', displayName: null };
  };
  const publishedCounters = (interpretationId: string) =>
    [...counters.values()].filter(
      (c) => c.interpretationId === interpretationId && c.status === 'published',
    );

  const toModerationReport = (r: (typeof reports)[number]): ModerationReport => {
    const i = r.targetType === 'interpretation' ? interps.get(r.targetId) : undefined;
    const c = r.targetType === 'counter_reading' ? counters.get(r.targetId) : undefined;
    const interpretationId = i?.id ?? c?.interpretationId;
    return {
      id: r.id,
      targetType: r.targetType,
      targetId: r.targetId,
      reason: r.reason,
      details: r.details,
      status: r.status,
      createdAt: r.createdAt,
      resolvedAt: r.resolvedAt,
      reporter: { username: users.get(r.reporterId)?.username ?? 'unknown' },
      target:
        interpretationId === undefined
          ? null
          : {
              status: (i ?? c)!.status,
              authorUsername: authorOf((i ?? c)!.authorId).username,
              interpretationId,
              excerpt: i ? `${i.title}: ${i.claim}` : c!.body,
            },
    };
  };

  const filmKeys = new Map<string, string>(); // "provider:providerFilmId" -> film id

  const repo: Repository = {
    async findFilmIdsByProvider(provider, ids) {
      const out: Record<string, string> = {};
      for (const id of ids) {
        const filmId = filmKeys.get(`${provider}:${id}`);
        if (filmId) out[id] = filmId;
      }
      return out;
    },
    async createFilmIfMissing(input) {
      const key = `${input.provider}:${input.providerFilmId}`;
      const existingId = filmKeys.get(key);
      if (existingId) return { film: films.get(existingId)!, created: false };
      const film: Film = {
        id: randomUUID(),
        title: input.title,
        releaseYear: input.releaseYear,
        director: input.director,
        posterPath: input.posterPath,
        metadataAttribution: input.metadataAttribution,
      };
      films.set(film.id, film);
      filmKeys.set(key, film.id);
      return { film, created: true };
    },
    async searchFilms({ query, page, pageSize }) {
      const all = [...films.values()].filter(
        (f) => !query || f.title.toLowerCase().includes(query.toLowerCase()),
      );
      return {
        items: all.slice((page - 1) * pageSize, page * pageSize),
        total: all.length,
        page,
        pageSize,
      };
    },
    async getFilm(id) {
      return films.get(id) ?? null;
    },
    async listPublishedInterpretations(filmId, { tag, page, pageSize }) {
      const all = [...interps.values()]
        .filter(
          (i) => i.filmId === filmId && i.status === 'published' && (!tag || i.tags.includes(tag)),
        )
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return {
        items: all.slice((page - 1) * pageSize, page * pageSize).map((i) => ({
          id: i.id,
          filmId: i.filmId,
          author: i.author,
          title: i.title,
          claim: i.claim,
          interpretationType: i.interpretationType,
          spoilerLevel: i.spoilerLevel,
          tags: i.tags,
          evidenceCount: i.evidence.length,
          counterReadingCount: publishedCounters(i.id).length,
          createdAt: i.createdAt,
        })),
        total: all.length,
        page,
        pageSize,
      };
    },
    async getPublishedInterpretation(id) {
      const i = interps.get(id);
      if (!i || i.status !== 'published') return null;
      return { ...i, counterReadings: publishedCounters(id) };
    },
    async getInterpretationOwnership(id) {
      const i = interps.get(id);
      return i ? { id: i.id, authorId: i.authorId, status: i.status } : null;
    },
    async getCounterReadingOwnership(id) {
      const c = counters.get(id);
      return c
        ? { id: c.id, authorId: c.authorId, status: c.status, interpretationId: c.interpretationId }
        : null;
    },
    async createInterpretation(input) {
      const now = new Date();
      const i: Interpretation = {
        id: randomUUID(),
        filmId: input.filmId,
        authorId: input.authorId,
        author: authorOf(input.authorId),
        title: input.title,
        claim: input.claim,
        interpretationType: input.interpretationType,
        spoilerLevel: input.spoilerLevel,
        status: 'published',
        tags: input.tags,
        evidence: input.evidence.map(mkEvidence),
        counterReadings: [],
        createdAt: now,
        updatedAt: now,
      };
      i.evidence.forEach((e) => evidenceParents.push({ evidenceId: e.id, interpretationId: i.id }));
      interps.set(i.id, i);
      return i;
    },
    async updateInterpretation(id, patch) {
      const i = interps.get(id)!;
      const next = {
        ...i,
        ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)),
        updatedAt: new Date(),
      } as Interpretation;
      interps.set(id, next);
      return next;
    },
    async setInterpretationStatus(id, status) {
      const i = interps.get(id)!;
      interps.set(id, { ...i, status });
    },
    async setCounterReadingStatus(id, status) {
      counters.get(id)!.status = status;
    },
    async addEvidenceToInterpretation(interpretationId, e) {
      const ev = mkEvidence(e);
      interps.get(interpretationId)!.evidence.push(ev);
      evidenceParents.push({ evidenceId: ev.id, interpretationId });
      return ev;
    },
    async addEvidenceToCounterReading(counterReadingId, e) {
      const ev = mkEvidence(e);
      counters.get(counterReadingId)!.evidence.push(ev);
      evidenceParents.push({ evidenceId: ev.id, counterReadingId });
      return ev;
    },
    async createCounterReading({ interpretationId, authorId, body, evidence }) {
      const now = new Date();
      const c = {
        id: randomUUID(),
        interpretationId,
        authorId,
        author: authorOf(authorId),
        body,
        evidence: evidence.map(mkEvidence),
        status: 'published' as const,
        createdAt: now,
        updatedAt: now,
      };
      c.evidence.forEach((e) => evidenceParents.push({ evidenceId: e.id, counterReadingId: c.id }));
      counters.set(c.id, c);
      return c;
    },
    async createReport({ reporterId, targetType, targetId, reason, details }) {
      const dup = reports.find(
        (r) =>
          r.reporterId === reporterId && r.targetType === targetType && r.targetId === targetId,
      );
      if (dup) return { id: dup.id, created: false };
      const id = randomUUID();
      reports.push({
        id,
        reporterId,
        targetType,
        targetId,
        reason,
        details: details ?? null,
        status: 'open',
        createdAt: new Date(),
        resolvedAt: null,
      });
      return { id, created: true };
    },
    async listReports({ status, page, pageSize }) {
      const all = reports.filter((r) => r.status === status);
      const items = all.slice((page - 1) * pageSize, page * pageSize).map(toModerationReport);
      return { items, total: all.length, page, pageSize };
    },
    async resolveReport({ reportId, moderatorId, action, note }) {
      const report = reports.find((r) => r.id === reportId);
      if (!report || report.status !== 'open') return null;
      const now = new Date();
      if (action === 'dismiss') {
        report.status = 'dismissed';
        report.resolvedAt = now;
      } else {
        const status = action === 'hide' ? 'hidden' : 'removed';
        if (report.targetType === 'interpretation') {
          interps.set(report.targetId, { ...interps.get(report.targetId)!, status });
        } else {
          counters.get(report.targetId)!.status = status;
        }
        for (const r of reports) {
          if (
            r.targetType === report.targetType &&
            r.targetId === report.targetId &&
            r.status === 'open'
          ) {
            r.status = 'actioned';
            r.resolvedAt = now;
          }
        }
      }
      auditLog.push({ moderatorId, reportId, action, ...(note ? { note } : {}) });
      actions.push({ targetType: report.targetType, targetId: report.targetId, action });
      return toModerationReport(report);
    },
    async restoreContent({ targetType, targetId, moderatorId, note }) {
      const target =
        targetType === 'interpretation' ? interps.get(targetId) : counters.get(targetId);
      if (!target) return 'not_found';
      const latest = [...actions]
        .reverse()
        .find((a) => a.targetType === targetType && a.targetId === targetId);
      if (
        target.status === 'published' ||
        (latest?.action !== 'hide' && latest?.action !== 'remove')
      ) {
        return 'not_restorable';
      }
      if (targetType === 'interpretation') {
        interps.set(targetId, { ...interps.get(targetId)!, status: 'published' });
      } else {
        counters.get(targetId)!.status = 'published';
      }
      actions.push({ targetType, targetId, action: 'restore' });
      auditLog.push({ moderatorId, reportId: '', action: 'restore', ...(note ? { note } : {}) });
      return 'restored';
    },
    async getUserProfile(username) {
      const u = [...users.values()].find((x) => x.username === username);
      return u
        ? { id: u.id, username: u.username, displayName: null, bio: null, joinedAt: new Date(0) }
        : null;
    },
    async listUserInterpretations(userId, { page, pageSize }) {
      const all = [...interps.values()]
        .filter((i) => i.authorId === userId && i.status === 'published')
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return {
        items: all.slice((page - 1) * pageSize, page * pageSize).map((i) => ({
          id: i.id,
          filmId: i.filmId,
          filmTitle: films.get(i.filmId)?.title ?? '',
          author: i.author,
          title: i.title,
          claim: i.claim,
          interpretationType: i.interpretationType,
          spoilerLevel: i.spoilerLevel,
          tags: i.tags,
          evidenceCount: i.evidence.length,
          counterReadingCount: publishedCounters(i.id).length,
          createdAt: i.createdAt,
        })),
        total: all.length,
        page,
        pageSize,
      };
    },
    async listUserCounterReadings(userId, { limit }) {
      const all = [...counters.values()]
        .filter((c) => c.authorId === userId && c.status === 'published')
        .flatMap((c) => {
          const parent = interps.get(c.interpretationId);
          return parent && parent.status === 'published' ? [{ c, parent }] : [];
        })
        .sort((a, b) => b.c.createdAt.getTime() - a.c.createdAt.getTime());
      return {
        items: all.slice(0, limit).map(({ c, parent }) => ({
          id: c.id,
          interpretationId: c.interpretationId,
          filmId: parent.filmId,
          filmTitle: films.get(parent.filmId)?.title ?? '',
          parentSpoilerLevel: parent.spoilerLevel,
          body: c.body,
          createdAt: c.createdAt,
        })),
        total: all.length,
      };
    },
    async ensureUser({ id, usernameHint }) {
      const existing = users.get(id);
      if (existing) return existing;
      const u: AppUser = { id, username: sanitizeUsername(usernameHint, id), role: 'user' };
      users.set(id, u);
      return u;
    },
  };

  return {
    repo,
    addFilm(title = 'Test Film'): Film {
      const f: Film = {
        id: randomUUID(),
        title,
        releaseYear: 1927,
        director: null,
        posterPath: null,
        metadataAttribution: null,
      };
      films.set(f.id, f);
      return f;
    },
    addUser(username: string, role: UserRole = 'user'): AppUser {
      const u: AppUser = { id: randomUUID(), username, role };
      users.set(u.id, u);
      return u;
    },
    setStatus(id: string, status: 'published' | 'hidden' | 'removed') {
      const i = interps.get(id)!;
      interps.set(id, { ...i, status });
    },
    setCounterStatus(id: string, status: 'published' | 'hidden' | 'removed') {
      counters.get(id)!.status = status;
    },
    evidenceParents,
    reports,
    auditLog,
  };
}

/** Test verifier: the token "token-for-<userId>" authenticates that user. Anything else is invalid. */
export const fakeVerifier = (): AuthVerifier => ({
  async verify(token) {
    const m = token.match(/^token-for-(.+)$/);
    return m?.[1] ? { id: m[1], usernameHint: 'tester' } : null;
  },
});
export const bearer = (u: AppUser) => ({ Authorization: `Bearer token-for-${u.id}` });

export function buildTestApp(
  opts: { writeLimitPerMinute?: number; metadata?: FilmMetadataProvider } = {},
) {
  const mem = createMemoryRepo();
  const app = createApp({
    repo: mem.repo,
    auth: fakeVerifier(),
    ...(opts.metadata ? { metadata: opts.metadata } : {}),
    webOrigin: 'http://localhost:5173',
    writeLimitPerMinute: opts.writeLimitPerMinute ?? 1000,
  });
  return { app, ...mem };
}

export const validEvidence = {
  evidenceType: 'observation' as const,
  description: 'The frame is symmetrical during the confrontation.',
};
export const validInterpretation = (filmId: string, over: Record<string, unknown> = {}) => ({
  filmId,
  title: 'A reading of symmetry',
  claim: 'The symmetry signals imposed order.',
  interpretationType: 'interpretation',
  spoilerLevel: 'none',
  evidence: [validEvidence],
  ...over,
});
