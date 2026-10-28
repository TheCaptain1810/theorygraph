import { useState } from 'react';
import { ApiClientError } from '../api/client';
import { FormError, secondaryButton } from './Form';

/**
 * Two-step destructive action: the first click asks, the second performs it. Deliberately not
 * window.confirm, so it is styled, testable and screen-reader friendly.
 */
export function ConfirmButton({
  label,
  prompt,
  confirmLabel,
  onConfirm,
}: {
  label: string;
  prompt: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
}) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Something went wrong.');
      setBusy(false);
    }
  }

  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className={secondaryButton}>
        {label}
      </button>
    );
  }
  return (
    <div role="group" aria-label={label} className="space-y-2 rounded border border-danger/50 p-3">
      <p className="text-sm">{prompt}</p>
      <FormError message={error} />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void run()}
          className="rounded bg-danger px-3 py-1.5 text-sm font-medium text-bg disabled:opacity-60"
        >
          {busy ? 'Working…' : confirmLabel}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setAsking(false)}
          className={secondaryButton}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
