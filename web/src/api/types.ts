// Mirrors the public JSON returned by the API (server/src/domain/spoilers.ts and routes).
export type InterpretationType = 'interpretation' | 'fan_theory' | 'production_fact' | 'question';
export type SpoilerLevel = 'none' | 'minor' | 'major';
export type EvidenceType = 'observation' | 'external_source' | 'production_fact';

export interface Film {
  id: string;
  title: string;
  releaseYear: number | null;
  director: string | null;
  posterPath: string | null;
  metadataAttribution: string | null;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuthorRef {
  username: string;
  displayName: string | null;
}

export interface Evidence {
  id: string;
  evidenceType: EvidenceType;
  description: string;
  sceneDescription: string | null;
  timestampSeconds: number | null;
  sourceUrl: string | null;
  createdAt: string;
}

export interface CounterReading {
  id: string;
  author: AuthorRef;
  body: string;
  evidence: Evidence[];
  createdAt: string;
}

interface SummaryBase {
  id: string;
  filmId: string;
  interpretationType: InterpretationType;
  spoilerLevel: SpoilerLevel;
  evidenceCount: number;
  counterReadingCount: number;
  createdAt: string;
}

export type InterpretationSummary =
  | (SummaryBase & {
      concealed: false;
      author: AuthorRef;
      title: string;
      claim: string;
      tags: string[];
    })
  | (SummaryBase & { concealed: true });

export type InterpretationDetail =
  | {
      concealed: true;
      id: string;
      filmId: string;
      interpretationType: InterpretationType;
      spoilerLevel: SpoilerLevel;
      evidenceCount: number;
      counterReadingCount: number;
      createdAt: string;
    }
  | {
      concealed: false;
      id: string;
      filmId: string;
      author: AuthorRef;
      title: string;
      claim: string;
      interpretationType: InterpretationType;
      spoilerLevel: SpoilerLevel;
      tags: string[];
      evidence: Evidence[];
      counterReadings: CounterReading[];
      createdAt: string;
      updatedAt: string;
    };

export type ProfileInterpretation = InterpretationSummary & { filmTitle: string };

export type ProfileCounterReading = {
  id: string;
  interpretationId: string;
  filmId: string;
  filmTitle: string;
  spoilerLevel: SpoilerLevel;
  createdAt: string;
} & ({ concealed: true } | { concealed: false; excerpt: string });

export interface ProfileResponse {
  user: { username: string; displayName: string | null; bio: string | null; joinedAt: string };
  interpretations: Page<ProfileInterpretation>;
  counterReadings: { total: number; items: ProfileCounterReading[] };
}

export type ReportTargetType = 'interpretation' | 'counter_reading';
export type ReportReason =
  'abuse' | 'plagiarism' | 'spam' | 'misinformation' | 'copyright' | 'spoiler' | 'other';
export type ReportStatus = 'open' | 'dismissed' | 'actioned';
export type ModerationAction = 'dismiss' | 'hide' | 'remove';

export interface ModerationReport {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  createdAt: string;
  resolvedAt: string | null;
  reporter: { username: string };
  target: {
    status: 'published' | 'hidden' | 'removed';
    authorUsername: string;
    interpretationId: string;
    excerpt: string;
  } | null;
}

export interface MetadataCandidate {
  tmdbId: number;
  title: string;
  releaseYear: number | null;
  posterPath: string | null;
  /** Our film id when already in the catalogue. */
  filmId: string | null;
}
