import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '../generated/prisma/client.js';
import { sanitizeUsername } from '../auth.js';
import type {
  AppUser,
  CounterReading,
  Evidence,
  Film,
  Interpretation,
  InterpretationSummary,
  ModerationReport,
  NewEvidence,
  UserProfile,
} from '../domain/types.js';
import type { Repository } from './types.js';

export function createPrismaClient(connectionString: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

const authorSelect = { select: { username: true, displayName: true } } as const;
const evidenceArgs = { orderBy: { createdAt: 'asc' } } as const;

type EvidenceRow = Prisma.EvidenceGetPayload<object>;

const mapEvidence = (e: EvidenceRow): Evidence => ({
  id: e.id,
  evidenceType: e.evidenceType,
  description: e.description,
  sceneDescription: e.sceneDescription,
  timestampSeconds: e.timestampSeconds,
  sourceUrl: e.sourceUrl,
  createdAt: e.createdAt,
});

const evidenceData = (e: NewEvidence) => ({
  evidenceType: e.evidenceType,
  description: e.description,
  sceneDescription: e.sceneDescription ?? null,
  timestampSeconds: e.timestampSeconds ?? null,
  sourceUrl: e.sourceUrl ?? null,
});

const fullInclude = {
  author: authorSelect,
  tags: { include: { tag: true } },
  evidence: evidenceArgs,
  counterReadings: {
    where: { status: 'published' },
    orderBy: { createdAt: 'asc' },
    include: { author: authorSelect, evidence: evidenceArgs },
  },
} satisfies Prisma.InterpretationInclude;

type FullRow = Prisma.InterpretationGetPayload<{ include: typeof fullInclude }>;

const mapInterpretation = (r: FullRow): Interpretation => ({
  id: r.id,
  filmId: r.filmId,
  authorId: r.authorId,
  author: r.author,
  title: r.title,
  claim: r.claim,
  interpretationType: r.interpretationType,
  spoilerLevel: r.spoilerLevel,
  status: r.status,
  tags: r.tags.map((t) => t.tag.name),
  evidence: r.evidence.map(mapEvidence),
  counterReadings: r.counterReadings.map((c): CounterReading => ({
    id: c.id,
    interpretationId: c.interpretationId,
    authorId: c.authorId,
    author: c.author,
    body: c.body,
    evidence: c.evidence.map(mapEvidence),
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  })),
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

const mapFilm = (f: Prisma.FilmGetPayload<object>): Film => ({
  id: f.id,
  title: f.title,
  releaseYear: f.releaseYear,
  director: f.director,
  posterPath: f.posterPath,
  metadataAttribution: f.metadataAttribution,
});

const reportInclude = { reporter: { select: { username: true } } } satisfies Prisma.ReportInclude;
type ReportRow = Prisma.ReportGetPayload<{ include: typeof reportInclude }>;

const excerpt = (text: string) => (text.length > 280 ? `${text.slice(0, 277)}...` : text);

export function createPrismaRepository(db: PrismaClient): Repository {
  /** Attaches current target content to report rows (two batched queries, not one per report). */
  const withTargets = async (rows: ReportRow[]): Promise<ModerationReport[]> => {
    const ids = (type: 'interpretation' | 'counter_reading') =>
      rows.filter((r) => r.targetType === type).map((r) => r.targetId);
    const [interps, counters] = await Promise.all([
      db.interpretation.findMany({
        where: { id: { in: ids('interpretation') } },
        select: {
          id: true,
          status: true,
          title: true,
          claim: true,
          author: { select: { username: true } },
        },
      }),
      db.counterReading.findMany({
        where: { id: { in: ids('counter_reading') } },
        select: {
          id: true,
          status: true,
          body: true,
          interpretationId: true,
          author: { select: { username: true } },
        },
      }),
    ]);
    const iMap = new Map(interps.map((i) => [i.id, i]));
    const cMap = new Map(counters.map((c) => [c.id, c]));
    return rows.map((r): ModerationReport => {
      let target: ModerationReport['target'] = null;
      if (r.targetType === 'interpretation') {
        const i = iMap.get(r.targetId);
        if (i) {
          target = {
            status: i.status,
            authorUsername: i.author.username,
            interpretationId: i.id,
            excerpt: excerpt(`${i.title}: ${i.claim}`),
          };
        }
      } else {
        const c = cMap.get(r.targetId);
        if (c) {
          target = {
            status: c.status,
            authorUsername: c.author.username,
            interpretationId: c.interpretationId,
            excerpt: excerpt(c.body),
          };
        }
      }
      return {
        id: r.id,
        targetType: r.targetType,
        targetId: r.targetId,
        reason: r.reason,
        details: r.details,
        status: r.status,
        createdAt: r.createdAt,
        resolvedAt: r.resolvedAt,
        reporter: r.reporter,
        target,
      };
    });
  };

  const loadFull = async (id: string): Promise<Interpretation> => {
    const row = await db.interpretation.findUniqueOrThrow({ where: { id }, include: fullInclude });
    return mapInterpretation(row);
  };

  return {
    async searchFilms({ query, page, pageSize }) {
      const where: Prisma.FilmWhereInput = query
        ? { title: { contains: query, mode: 'insensitive' } }
        : {};
      const [rows, total] = await Promise.all([
        db.film.findMany({
          where,
          orderBy: [{ title: 'asc' }, { id: 'asc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        db.film.count({ where }),
      ]);
      return { items: rows.map(mapFilm), total, page, pageSize };
    },

    async getFilm(id) {
      const f = await db.film.findUnique({ where: { id } });
      return f ? mapFilm(f) : null;
    },

    async findFilmIdsByProvider(provider, providerFilmIds) {
      if (providerFilmIds.length === 0) return {};
      const rows = await db.film.findMany({
        where: { provider, providerFilmId: { in: providerFilmIds } },
        select: { id: true, providerFilmId: true },
      });
      return Object.fromEntries(rows.map((r) => [r.providerFilmId, r.id]));
    },

    async createFilmIfMissing(input) {
      try {
        return { film: mapFilm(await db.film.create({ data: input })), created: true };
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          const existing = await db.film.findUniqueOrThrow({
            where: {
              provider_providerFilmId: {
                provider: input.provider,
                providerFilmId: input.providerFilmId,
              },
            },
          });
          return { film: mapFilm(existing), created: false };
        }
        throw e;
      }
    },

    async listPublishedInterpretations(filmId, { tag, page, pageSize }) {
      const where: Prisma.InterpretationWhereInput = {
        filmId,
        status: 'published',
        ...(tag ? { tags: { some: { tag: { name: tag } } } } : {}),
      };
      const [rows, total] = await Promise.all([
        db.interpretation.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            author: authorSelect,
            tags: { include: { tag: true } },
            _count: {
              select: { evidence: true, counterReadings: { where: { status: 'published' } } },
            },
          },
        }),
        db.interpretation.count({ where }),
      ]);
      const items: InterpretationSummary[] = rows.map((r) => ({
        id: r.id,
        filmId: r.filmId,
        author: r.author,
        title: r.title,
        claim: r.claim,
        interpretationType: r.interpretationType,
        spoilerLevel: r.spoilerLevel,
        tags: r.tags.map((t) => t.tag.name),
        evidenceCount: r._count.evidence,
        counterReadingCount: r._count.counterReadings,
        createdAt: r.createdAt,
      }));
      return { items, total, page, pageSize };
    },

    async getPublishedInterpretation(id) {
      const row = await db.interpretation.findFirst({
        where: { id, status: 'published' },
        include: fullInclude,
      });
      return row ? mapInterpretation(row) : null;
    },

    async getInterpretationOwnership(id) {
      return db.interpretation.findUnique({
        where: { id },
        select: { id: true, authorId: true, status: true },
      });
    },

    async getCounterReadingOwnership(id) {
      return db.counterReading.findUnique({
        where: { id },
        select: { id: true, authorId: true, status: true, interpretationId: true },
      });
    },

    async createInterpretation(input) {
      const created = await db.$transaction(async (tx) => {
        const tagRecords = await Promise.all(
          input.tags.map((name) =>
            tx.tag.upsert({ where: { name }, update: {}, create: { name } }),
          ),
        );
        return tx.interpretation.create({
          data: {
            filmId: input.filmId,
            authorId: input.authorId,
            title: input.title,
            claim: input.claim,
            interpretationType: input.interpretationType,
            spoilerLevel: input.spoilerLevel,
            evidence: { create: input.evidence.map(evidenceData) },
            tags: { create: tagRecords.map((t) => ({ tagId: t.id })) },
          },
          select: { id: true },
        });
      });
      return loadFull(created.id);
    },

    async updateInterpretation(id, patch) {
      await db.interpretation.update({
        where: { id },
        data: {
          ...(patch.title !== undefined ? { title: patch.title } : {}),
          ...(patch.claim !== undefined ? { claim: patch.claim } : {}),
          ...(patch.interpretationType !== undefined
            ? { interpretationType: patch.interpretationType }
            : {}),
          ...(patch.spoilerLevel !== undefined ? { spoilerLevel: patch.spoilerLevel } : {}),
        },
      });
      return loadFull(id);
    },

    async setInterpretationStatus(id, status) {
      await db.interpretation.update({ where: { id }, data: { status } });
    },

    async setCounterReadingStatus(id, status) {
      await db.counterReading.update({ where: { id }, data: { status } });
    },

    async addEvidenceToInterpretation(interpretationId, evidence) {
      const row = await db.evidence.create({
        data: { interpretationId, ...evidenceData(evidence) },
      });
      return mapEvidence(row);
    },

    async addEvidenceToCounterReading(counterReadingId, evidence) {
      const row = await db.evidence.create({
        data: { counterReadingId, ...evidenceData(evidence) },
      });
      return mapEvidence(row);
    },

    async createCounterReading({ interpretationId, authorId, body, evidence }) {
      const row = await db.counterReading.create({
        data: {
          interpretationId,
          authorId,
          body,
          evidence: { create: evidence.map(evidenceData) },
        },
        include: { author: authorSelect, evidence: evidenceArgs },
      });
      return {
        id: row.id,
        interpretationId: row.interpretationId,
        authorId: row.authorId,
        author: row.author,
        body: row.body,
        evidence: row.evidence.map(mapEvidence),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    },

    async createReport({ reporterId, targetType, targetId, reason, details }) {
      try {
        const r = await db.report.create({
          data: { reporterId, targetType, targetId, reason, details: details ?? null },
          select: { id: true },
        });
        return { id: r.id, created: true };
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          const existing = await db.report.findUniqueOrThrow({
            where: { reporterId_targetType_targetId: { reporterId, targetType, targetId } },
            select: { id: true },
          });
          return { id: existing.id, created: false };
        }
        throw e;
      }
    },

    async listReports({ status, page, pageSize }) {
      const where = { status };
      const [rows, total] = await Promise.all([
        db.report.findMany({
          where,
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], // oldest first: work the queue in order
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: reportInclude,
        }),
        db.report.count({ where }),
      ]);
      return { items: await withTargets(rows), total, page, pageSize };
    },

    async resolveReport({ reportId, moderatorId, action, note }) {
      const resolvedId = await db.$transaction(async (tx) => {
        const report = await tx.report.findUnique({ where: { id: reportId } });
        if (!report || report.status !== 'open') return null;
        const now = new Date();
        if (action === 'dismiss') {
          await tx.report.update({
            where: { id: reportId },
            data: { status: 'dismissed', resolvedAt: now },
          });
        } else {
          const status = action === 'hide' ? 'hidden' : 'removed';
          if (report.targetType === 'interpretation') {
            await tx.interpretation.update({ where: { id: report.targetId }, data: { status } });
          } else {
            await tx.counterReading.update({ where: { id: report.targetId }, data: { status } });
          }
          // Every open report about the same content is settled by the same decision.
          await tx.report.updateMany({
            where: { targetType: report.targetType, targetId: report.targetId, status: 'open' },
            data: { status: 'actioned', resolvedAt: now },
          });
        }
        await tx.moderationAction.create({
          data: {
            moderatorId,
            reportId,
            targetType: report.targetType,
            targetId: report.targetId,
            action,
            note: note ?? null,
          },
        });
        return reportId;
      });
      if (!resolvedId) return null;
      const row = await db.report.findUniqueOrThrow({
        where: { id: resolvedId },
        include: reportInclude,
      });
      return (await withTargets([row]))[0] ?? null;
    },

    async restoreContent({ targetType, targetId, moderatorId, note }) {
      return db.$transaction(async (tx) => {
        const target =
          targetType === 'interpretation'
            ? await tx.interpretation.findUnique({
                where: { id: targetId },
                select: { status: true },
              })
            : await tx.counterReading.findUnique({
                where: { id: targetId },
                select: { status: true },
              });
        if (!target) return 'not_found' as const;
        if (target.status === 'published') return 'not_restorable' as const;
        const latest = await tx.moderationAction.findFirst({
          where: { targetType, targetId },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: { action: true },
        });
        if (latest?.action !== 'hide' && latest?.action !== 'remove') {
          return 'not_restorable' as const;
        }
        if (targetType === 'interpretation') {
          await tx.interpretation.update({
            where: { id: targetId },
            data: { status: 'published' },
          });
        } else {
          await tx.counterReading.update({
            where: { id: targetId },
            data: { status: 'published' },
          });
        }
        await tx.moderationAction.create({
          data: { moderatorId, targetType, targetId, action: 'restore', note: note ?? null },
        });
        return 'restored' as const;
      });
    },

    async getUserProfile(username): Promise<UserProfile | null> {
      const u = await db.user.findUnique({ where: { username } });
      return u
        ? {
            id: u.id,
            username: u.username,
            displayName: u.displayName,
            bio: u.bio,
            joinedAt: u.createdAt,
          }
        : null;
    },

    async listUserInterpretations(userId, { page, pageSize }) {
      const where: Prisma.InterpretationWhereInput = { authorId: userId, status: 'published' };
      const [rows, total] = await Promise.all([
        db.interpretation.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            author: authorSelect,
            film: { select: { title: true } },
            tags: { include: { tag: true } },
            _count: {
              select: { evidence: true, counterReadings: { where: { status: 'published' } } },
            },
          },
        }),
        db.interpretation.count({ where }),
      ]);
      return {
        items: rows.map((r) => ({
          id: r.id,
          filmId: r.filmId,
          filmTitle: r.film.title,
          author: r.author,
          title: r.title,
          claim: r.claim,
          interpretationType: r.interpretationType,
          spoilerLevel: r.spoilerLevel,
          tags: r.tags.map((t) => t.tag.name),
          evidenceCount: r._count.evidence,
          counterReadingCount: r._count.counterReadings,
          createdAt: r.createdAt,
        })),
        total,
        page,
        pageSize,
      };
    },

    async listUserCounterReadings(userId, { limit }) {
      const where: Prisma.CounterReadingWhereInput = {
        authorId: userId,
        status: 'published',
        interpretation: { status: 'published' },
      };
      const [rows, total] = await Promise.all([
        db.counterReading.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: limit,
          include: {
            interpretation: {
              select: {
                filmId: true,
                spoilerLevel: true,
                film: { select: { title: true } },
              },
            },
          },
        }),
        db.counterReading.count({ where }),
      ]);
      return {
        items: rows.map((c) => ({
          id: c.id,
          interpretationId: c.interpretationId,
          filmId: c.interpretation.filmId,
          filmTitle: c.interpretation.film.title,
          parentSpoilerLevel: c.interpretation.spoilerLevel,
          body: c.body,
          createdAt: c.createdAt,
        })),
        total,
      };
    },

    async ensureUser({ id, usernameHint }): Promise<AppUser> {
      const existing = await db.user.findUnique({ where: { id } });
      if (existing) return { id: existing.id, username: existing.username, role: existing.role };
      const base = sanitizeUsername(usernameHint, id);
      // Retry with a suffix on the (rare) username collision.
      for (let attempt = 0; attempt < 5; attempt++) {
        const username =
          attempt === 0
            ? base
            : `${base.slice(0, 20)}_${id.replace(/-/g, '').slice(0, 3 + attempt)}`;
        try {
          const u = await db.user.create({ data: { id, username } });
          return { id: u.id, username: u.username, role: u.role };
        } catch (e) {
          if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
            const raced = await db.user.findUnique({ where: { id } });
            if (raced) return { id: raced.id, username: raced.username, role: raced.role };
            continue;
          }
          throw e;
        }
      }
      throw new Error('Could not allocate a username');
    },
  };
}
