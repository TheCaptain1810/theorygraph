import type {
  Interpretation,
  InterpretationSummary,
  ProfileCounterReading,
  ProfileInterpretation,
  SpoilerLevel,
} from './types.js';

/** Major spoilers are concealed everywhere until the reader deliberately reveals them. */
export function isConcealedByDefault(level: SpoilerLevel): boolean {
  return level === 'major';
}

/** A list card. For concealed items, no title/claim/tags text is sent at all (not merely hidden by CSS). */
export type PublicSummary =
  | {
      concealed: false;
      id: string;
      filmId: string;
      author: InterpretationSummary['author'];
      title: string;
      claim: string;
      interpretationType: InterpretationSummary['interpretationType'];
      spoilerLevel: SpoilerLevel;
      tags: string[];
      evidenceCount: number;
      counterReadingCount: number;
      createdAt: Date;
    }
  | {
      concealed: true;
      id: string;
      filmId: string;
      interpretationType: InterpretationSummary['interpretationType'];
      spoilerLevel: SpoilerLevel;
      evidenceCount: number;
      counterReadingCount: number;
      createdAt: Date;
    };

export function toPublicSummary(s: InterpretationSummary): PublicSummary {
  if (isConcealedByDefault(s.spoilerLevel)) {
    return {
      concealed: true,
      id: s.id,
      filmId: s.filmId,
      interpretationType: s.interpretationType,
      spoilerLevel: s.spoilerLevel,
      evidenceCount: s.evidenceCount,
      counterReadingCount: s.counterReadingCount,
      createdAt: s.createdAt,
    };
  }
  return {
    concealed: false,
    id: s.id,
    filmId: s.filmId,
    author: s.author,
    title: s.title,
    claim: s.claim,
    interpretationType: s.interpretationType,
    spoilerLevel: s.spoilerLevel,
    tags: s.tags,
    evidenceCount: s.evidenceCount,
    counterReadingCount: s.counterReadingCount,
    createdAt: s.createdAt,
  };
}

/**
 * Detail view. If the interpretation is major-spoiler and the caller has not explicitly
 * asked to reveal it, return only non-spoiling metadata (no title, claim, evidence,
 * counter-readings, or tags).
 */
export function toPublicDetail(i: Interpretation, reveal: boolean) {
  if (isConcealedByDefault(i.spoilerLevel) && !reveal) {
    return {
      concealed: true as const,
      id: i.id,
      filmId: i.filmId,
      interpretationType: i.interpretationType,
      spoilerLevel: i.spoilerLevel,
      evidenceCount: i.evidence.length,
      counterReadingCount: i.counterReadings.length,
      createdAt: i.createdAt,
    };
  }
  return {
    concealed: false as const,
    id: i.id,
    filmId: i.filmId,
    author: i.author,
    title: i.title,
    claim: i.claim,
    interpretationType: i.interpretationType,
    spoilerLevel: i.spoilerLevel,
    tags: i.tags,
    evidence: i.evidence.map(publicEvidence),
    counterReadings: i.counterReadings.map((c) => ({
      id: c.id,
      author: c.author,
      body: c.body,
      evidence: c.evidence.map(publicEvidence),
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    })),
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
  };
}

function publicEvidence(e: Interpretation['evidence'][number]) {
  return {
    id: e.id,
    evidenceType: e.evidenceType,
    description: e.description,
    sceneDescription: e.sceneDescription,
    timestampSeconds: e.timestampSeconds,
    sourceUrl: e.sourceUrl,
    createdAt: e.createdAt,
  };
}

/** Profile list item: the usual gated card plus the film title (not a spoiler). */
export function toPublicProfileInterpretation(i: ProfileInterpretation) {
  return { ...toPublicSummary(i), filmTitle: i.filmTitle };
}

/**
 * Counter-readings discuss the same material as their parent, so the parent's spoiler level
 * decides whether the text is sent. Concealed items carry no body text at all.
 */
export function toPublicProfileCounterReading(c: ProfileCounterReading) {
  const base = {
    id: c.id,
    interpretationId: c.interpretationId,
    filmId: c.filmId,
    filmTitle: c.filmTitle,
    spoilerLevel: c.parentSpoilerLevel,
    createdAt: c.createdAt,
  };
  if (isConcealedByDefault(c.parentSpoilerLevel)) return { ...base, concealed: true as const };
  return { ...base, concealed: false as const, excerpt: excerpt(c.body) };
}

function excerpt(text: string): string {
  return text.length > 280 ? `${text.slice(0, 277)}...` : text;
}
