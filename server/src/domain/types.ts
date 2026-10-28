// Plain domain types. The Prisma repository maps database rows to these so business
// logic (and tests) never depend on the ORM.

export const INTERPRETATION_TYPES = [
  'interpretation',
  'fan_theory',
  'production_fact',
  'question',
] as const;
export type InterpretationType = (typeof INTERPRETATION_TYPES)[number];

export const SPOILER_LEVELS = ['none', 'minor', 'major'] as const;
export type SpoilerLevel = (typeof SPOILER_LEVELS)[number];

export const CONTENT_STATUSES = ['published', 'hidden', 'removed'] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const EVIDENCE_TYPES = ['observation', 'external_source', 'production_fact'] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export const REPORT_TARGET_TYPES = ['interpretation', 'counter_reading'] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

export const REPORT_REASONS = [
  'abuse',
  'plagiarism',
  'spam',
  'misinformation',
  'copyright',
  'spoiler',
  'other',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_STATUSES = ['open', 'dismissed', 'actioned'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const MODERATION_ACTIONS = ['dismiss', 'hide', 'remove'] as const;
export type ModerationActionType = (typeof MODERATION_ACTIONS)[number];

/** A report as a moderator sees it, including the (possibly already hidden) target content. */
export interface ModerationReport {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  createdAt: Date;
  resolvedAt: Date | null;
  reporter: { username: string };
  target: {
    /** Content status right now (published/hidden/removed). */
    status: ContentStatus;
    authorUsername: string;
    /** Interpretation to link to (its own id, or the parent of a counter-reading). */
    interpretationId: string;
    /** Truncated text for triage; moderators may see spoiler text. */
    excerpt: string;
  } | null;
}

export type UserRole = 'user' | 'moderator' | 'admin';

export interface AppUser {
  id: string;
  username: string;
  role: UserRole;
}

export interface Film {
  id: string;
  title: string;
  releaseYear: number | null;
  director: string | null;
  posterPath: string | null;
  metadataAttribution: string | null;
}

export interface Evidence {
  id: string;
  evidenceType: EvidenceType;
  description: string;
  sceneDescription: string | null;
  timestampSeconds: number | null;
  sourceUrl: string | null;
  createdAt: Date;
}

export interface AuthorRef {
  username: string;
  displayName: string | null;
}

export interface CounterReading {
  id: string;
  interpretationId: string;
  author: AuthorRef;
  authorId: string;
  body: string;
  evidence: Evidence[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Interpretation {
  id: string;
  filmId: string;
  authorId: string;
  author: AuthorRef;
  title: string;
  claim: string;
  interpretationType: InterpretationType;
  spoilerLevel: SpoilerLevel;
  status: ContentStatus;
  tags: string[];
  evidence: Evidence[];
  counterReadings: CounterReading[];
  createdAt: Date;
  updatedAt: Date;
}

/** Row shape for list pages (no evidence bodies, just counts). */
export interface InterpretationSummary {
  id: string;
  filmId: string;
  author: AuthorRef;
  title: string;
  claim: string;
  interpretationType: InterpretationType;
  spoilerLevel: SpoilerLevel;
  tags: string[];
  evidenceCount: number;
  counterReadingCount: number;
  createdAt: Date;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface NewEvidence {
  evidenceType: EvidenceType;
  description: string;
  sceneDescription?: string | undefined;
  timestampSeconds?: number | undefined;
  sourceUrl?: string | undefined;
}

/** Public profile fields only. Never includes email or role. */
export interface UserProfile {
  id: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  joinedAt: Date;
}

export type ProfileInterpretation = InterpretationSummary & { filmTitle: string };

/** A user's counter-reading with its parent's context; spoiler gating uses the parent's level. */
export interface ProfileCounterReading {
  id: string;
  interpretationId: string;
  filmId: string;
  filmTitle: string;
  parentSpoilerLevel: SpoilerLevel;
  body: string;
  createdAt: Date;
}
