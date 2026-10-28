import { z } from 'zod';
import {
  EVIDENCE_TYPES,
  INTERPRETATION_TYPES,
  MODERATION_ACTIONS,
  REPORT_REASONS,
  REPORT_STATUSES,
  REPORT_TARGET_TYPES,
  SPOILER_LEVELS,
} from './types.js';

const trimmed = (max: number) => z.string().trim().min(1).max(max);

/** Only http(s) links, no embedded credentials. The UI must still render with rel="noopener noreferrer nofollow". */
export const safeUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => {
    try {
      const u = new URL(v);
      return (u.protocol === 'http:' || u.protocol === 'https:') && !u.username && !u.password;
    } catch {
      return false;
    }
  }, 'Must be a valid http(s) URL without credentials');

export const evidenceInput = z
  .object({
    evidenceType: z.enum(EVIDENCE_TYPES),
    description: trimmed(2000),
    sceneDescription: trimmed(500).optional(),
    // Non-negative whole seconds; upper bound guards against absurd values.
    timestampSeconds: z.number().int().min(0).max(1_000_000).optional(),
    sourceUrl: safeUrl.optional(),
  })
  .superRefine((e, ctx) => {
    if (e.evidenceType === 'external_source' && !e.sourceUrl) {
      ctx.addIssue({
        code: 'custom',
        path: ['sourceUrl'],
        message: 'An external source needs a link',
      });
    }
  });
export type EvidenceInput = z.infer<typeof evidenceInput>;

/** MVP rule: at least one observation or scene reference is required. */
export function isObservationOrSceneReference(e: EvidenceInput): boolean {
  return (
    e.evidenceType === 'observation' ||
    e.sceneDescription !== undefined ||
    e.timestampSeconds !== undefined
  );
}

const tagName = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9 -]{0,38}[a-z0-9]$/, 'Tags are 2–40 letters, numbers, spaces or hyphens');

export const createInterpretationInput = z.object({
  filmId: z.uuid(),
  title: trimmed(160),
  claim: trimmed(8000),
  interpretationType: z.enum(INTERPRETATION_TYPES),
  spoilerLevel: z.enum(SPOILER_LEVELS),
  evidence: z
    .array(evidenceInput)
    .min(1, 'Add at least one observation or scene reference')
    .max(20)
    .refine((list) => list.some(isObservationOrSceneReference), {
      message: 'Add at least one observation or scene reference',
    }),
  tags: z.array(tagName).max(8).optional(),
});
export type CreateInterpretationInput = z.infer<typeof createInterpretationInput>;

export const updateInterpretationInput = z
  .object({
    title: trimmed(160),
    claim: trimmed(8000),
    interpretationType: z.enum(INTERPRETATION_TYPES),
    spoilerLevel: z.enum(SPOILER_LEVELS),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field to change' });
export type UpdateInterpretationInput = z.infer<typeof updateInterpretationInput>;

export const createCounterReadingInput = z.object({
  body: trimmed(8000),
  evidence: z.array(evidenceInput).max(20).optional(),
});
export type CreateCounterReadingInput = z.infer<typeof createCounterReadingInput>;

export const idParam = z.uuid();

export const listQuery = z.object({
  query: z.string().trim().max(100).optional(),
  tag: z.string().trim().toLowerCase().max(40).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});

export const revealQuery = z.object({
  reveal: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

export const createReportInput = z.object({
  targetType: z.enum(REPORT_TARGET_TYPES),
  targetId: z.uuid(),
  reason: z.enum(REPORT_REASONS),
  details: trimmed(1000).optional(),
});
export type CreateReportInput = z.infer<typeof createReportInput>;

export const resolveReportInput = z.object({
  action: z.enum(MODERATION_ACTIONS),
  note: trimmed(1000).optional(),
});
export type ResolveReportInput = z.infer<typeof resolveReportInput>;

export const restoreInput = z.object({ note: trimmed(1000).optional() });

export const reportListQuery = z.object({
  status: z.enum(REPORT_STATUSES).default('open'),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});

export const usernameParam = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,40}$/, 'Invalid username');

export const profileQuery = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});
