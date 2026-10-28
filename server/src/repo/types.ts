import type {
  AppUser,
  CounterReading,
  Evidence,
  Film,
  Interpretation,
  InterpretationSummary,
  NewEvidence,
  Page,
  ProfileCounterReading,
  ProfileInterpretation,
  UserProfile,
  ContentStatus,
  InterpretationType,
  ModerationActionType,
  ModerationReport,
  ReportReason,
  ReportStatus,
  ReportTargetType,
  SpoilerLevel,
} from '../domain/types.js';

export interface NewInterpretation {
  filmId: string;
  authorId: string;
  title: string;
  claim: string;
  interpretationType: InterpretationType;
  spoilerLevel: SpoilerLevel;
  evidence: NewEvidence[];
  tags: string[];
}

export interface InterpretationPatch {
  title?: string | undefined;
  claim?: string | undefined;
  interpretationType?: InterpretationType | undefined;
  spoilerLevel?: SpoilerLevel | undefined;
}

/** Minimal ownership/status info used for authorization decisions. */
export interface OwnershipRecord {
  id: string;
  authorId: string;
  status: ContentStatus;
}

/**
 * Persistence boundary. All "public" reads return published content only; hidden/removed
 * content is never returned from `list*`/`get*Public` methods.
 */
export interface Repository {
  searchFilms(opts: {
    query?: string | undefined;
    page: number;
    pageSize: number;
  }): Promise<Page<Film>>;
  getFilm(id: string): Promise<Film | null>;
  /** Maps provider film ids to our film ids, for those already in the catalogue. */
  findFilmIdsByProvider(
    provider: string,
    providerFilmIds: string[],
  ): Promise<Record<string, string>>;
  /** Idempotent on (provider, providerFilmId): a repeat returns the existing film with created=false. */
  createFilmIfMissing(input: {
    provider: string;
    providerFilmId: string;
    title: string;
    releaseYear: number | null;
    director: string | null;
    posterPath: string | null;
    metadataAttribution: string | null;
  }): Promise<{ film: Film; created: boolean }>;

  listPublishedInterpretations(
    filmId: string,
    opts: { tag?: string | undefined; page: number; pageSize: number },
  ): Promise<Page<InterpretationSummary>>;
  /** Published interpretation with published counter-readings and their evidence. */
  getPublishedInterpretation(id: string): Promise<Interpretation | null>;

  getInterpretationOwnership(id: string): Promise<OwnershipRecord | null>;
  getCounterReadingOwnership(
    id: string,
  ): Promise<(OwnershipRecord & { interpretationId: string }) | null>;

  createInterpretation(input: NewInterpretation): Promise<Interpretation>;
  updateInterpretation(id: string, patch: InterpretationPatch): Promise<Interpretation>;
  setInterpretationStatus(id: string, status: ContentStatus): Promise<void>;

  setCounterReadingStatus(id: string, status: ContentStatus): Promise<void>;

  addEvidenceToInterpretation(interpretationId: string, evidence: NewEvidence): Promise<Evidence>;
  addEvidenceToCounterReading(counterReadingId: string, evidence: NewEvidence): Promise<Evidence>;

  createCounterReading(input: {
    interpretationId: string;
    authorId: string;
    body: string;
    evidence: NewEvidence[];
  }): Promise<CounterReading>;

  /** Idempotent per (reporter, target): a repeat returns the existing report with created=false. */
  createReport(input: {
    reporterId: string;
    targetType: ReportTargetType;
    targetId: string;
    reason: ReportReason;
    details?: string | undefined;
  }): Promise<{ id: string; created: boolean }>;
  listReports(opts: {
    status: ReportStatus;
    page: number;
    pageSize: number;
  }): Promise<Page<ModerationReport>>;
  /**
   * Atomically records the decision: updates the target's status for hide/remove, closes every open
   * report on that target, and appends to the audit log. Returns null if the report is missing or
   * already resolved.
   */
  resolveReport(input: {
    reportId: string;
    moderatorId: string;
    action: ModerationActionType;
    note?: string | undefined;
  }): Promise<ModerationReport | null>;

  getUserProfile(username: string): Promise<UserProfile | null>;
  /** Published interpretations by the user, newest first. */
  listUserInterpretations(
    userId: string,
    opts: { page: number; pageSize: number },
  ): Promise<Page<ProfileInterpretation>>;
  /** Published counter-readings (on published interpretations) by the user, newest first. */
  listUserCounterReadings(
    userId: string,
    opts: { limit: number },
  ): Promise<{ items: ProfileCounterReading[]; total: number }>;

  /**
   * Puts content a moderator hid or removed back to published, and appends a `restore` audit row.
   * Only content whose latest moderation decision was hide/remove is restorable, so a moderator
   * cannot undo an author deleting their own work.
   */
  restoreContent(input: {
    targetType: ReportTargetType;
    targetId: string;
    moderatorId: string;
    note?: string | undefined;
  }): Promise<'restored' | 'not_found' | 'not_restorable'>;

  /** Ensures a profile row exists for an authenticated identity and returns it (role comes from the DB). */
  ensureUser(identity: { id: string; usernameHint: string }): Promise<AppUser>;
}
