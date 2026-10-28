import type { EvidenceType } from '../api/types';

export interface EvidenceRow {
  key: number;
  evidenceType: EvidenceType;
  description: string;
  sceneDescription: string;
  /** Free text: "75", "1:15" or "1:02:05". */
  timestamp: string;
  sourceUrl: string;
}

let nextKey = 1;
export function newEvidenceRow(evidenceType: EvidenceType = 'observation'): EvidenceRow {
  return {
    key: nextKey++,
    evidenceType,
    description: '',
    sceneDescription: '',
    timestamp: '',
    sourceUrl: '',
  };
}

/** "1:02:05" -> 3725, "1:15" -> 75, "75" -> 75. Returns null for blank, NaN for invalid (incl. negative). */
export function parseTimestamp(raw: string): number | null {
  const v = raw.trim();
  if (v === '') return null;
  if (!/^\d+(:[0-5]?\d){0,2}$/.test(v)) return NaN;
  const parts = v.split(':').map(Number);
  let secs = 0;
  for (const p of parts) secs = secs * 60 + p;
  return secs;
}

export function isRowBlank(r: EvidenceRow): boolean {
  return (
    !r.description.trim() &&
    !r.sceneDescription.trim() &&
    !r.timestamp.trim() &&
    !r.sourceUrl.trim()
  );
}

export interface EvidencePayload {
  evidenceType: EvidenceType;
  description: string;
  sceneDescription?: string;
  timestampSeconds?: number;
  sourceUrl?: string;
}

/** Client-side checks that mirror the server rules, keyed like the server: "evidence.<i>.<field>". */
export function validateRows(rows: EvidenceRow[]): Record<string, string> {
  const errors: Record<string, string> = {};
  rows.forEach((r, i) => {
    if (!r.description.trim()) errors[`evidence.${i}.description`] = 'Describe what you observed.';
    if (Number.isNaN(parseTimestamp(r.timestamp))) {
      errors[`evidence.${i}.timestampSeconds`] = 'Use a time like 1:15 or 1:02:05.';
    }
    if (r.evidenceType === 'external_source' && !r.sourceUrl.trim()) {
      errors[`evidence.${i}.sourceUrl`] = 'An external source needs a link.';
    }
  });
  return errors;
}

export function toPayload(rows: EvidenceRow[]): EvidencePayload[] {
  return rows.map((r) => {
    const ts = parseTimestamp(r.timestamp);
    return {
      evidenceType: r.evidenceType,
      description: r.description.trim(),
      ...(r.sceneDescription.trim() ? { sceneDescription: r.sceneDescription.trim() } : {}),
      ...(ts !== null && !Number.isNaN(ts) ? { timestampSeconds: ts } : {}),
      ...(r.sourceUrl.trim() ? { sourceUrl: r.sourceUrl.trim() } : {}),
    };
  });
}
