import type { EvidenceType, InterpretationType, ReportReason, SpoilerLevel } from '../api/types';

export const reportReasonLabel: Record<ReportReason, string> = {
  abuse: 'Harassment or abuse',
  plagiarism: 'Plagiarism',
  spam: 'Spam',
  misinformation: 'Misinformation presented as fact',
  copyright: 'Copyright concern',
  spoiler: 'Spoiler is not labelled correctly',
  other: 'Something else',
};

export const typeLabel: Record<InterpretationType, string> = {
  interpretation: 'Interpretation',
  fan_theory: 'Fan theory',
  production_fact: 'Production fact',
  question: 'Question',
};

export const evidenceLabel: Record<EvidenceType, string> = {
  observation: 'Observation',
  external_source: 'External source',
  production_fact: 'Production fact',
};

export const spoilerLabel: Record<SpoilerLevel, string> = {
  none: 'No spoilers',
  minor: 'Minor spoilers',
  major: 'Major spoilers',
};

/** 3725 -> "1:02:05", 75 -> "1:15". */
export function formatTimestamp(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
