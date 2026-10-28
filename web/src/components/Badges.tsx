import type { InterpretationType, SpoilerLevel } from '../api/types';
import { spoilerLabel, typeLabel } from './labels';

/** Spoiler status is always conveyed by text and a distinct symbol, never colour alone. */
export function SpoilerBadge({ level }: { level: SpoilerLevel }) {
  const symbol = level === 'none' ? '○' : level === 'minor' ? '◐' : '●';
  return (
    <span className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-xs text-muted">
      <span aria-hidden="true">{symbol}</span>
      {spoilerLabel[level]}
    </span>
  );
}

export function TypeBadge({ type }: { type: InterpretationType }) {
  return (
    <span className="inline-flex items-center rounded border border-accent/60 px-2 py-0.5 text-xs text-accent">
      {typeLabel[type]}
    </span>
  );
}
