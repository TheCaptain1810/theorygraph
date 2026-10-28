import type { ReactNode } from 'react';
import { ApiClientError } from '../api/client';

export const inputClass =
  'mt-1 w-full rounded border border-border bg-surface px-3 py-2 focus:border-accent';
export const primaryButton =
  'rounded bg-accent px-4 py-2 font-medium text-bg disabled:cursor-not-allowed disabled:opacity-60';
export const secondaryButton =
  'rounded border border-border px-3 py-1.5 text-sm hover:border-accent disabled:opacity-60';

/** Label + control + hint + error, wired together for screen readers. The control must use `id`. */
export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="mt-0.5 text-xs text-muted">
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export const describedBy = (id: string, hasHint: boolean, error?: string) =>
  [hasHint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;

/** Server validation issues keyed by dotted path, e.g. "evidence.0.sourceUrl". */
export function issuesByPath(err: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (err instanceof ApiClientError) {
    for (const d of err.details) if (!(d.path in out)) out[d.path] = d.message;
  }
  return out;
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded border border-danger/50 p-3 text-sm text-danger">
      {message}
    </div>
  );
}
