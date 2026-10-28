import { useState, type FormEvent } from 'react';
import { ApiClientError, apiSend } from '../api/client';
import type { ReportReason, ReportTargetType } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { Field, FormError, inputClass, issuesByPath, secondaryButton } from './Form';
import { reportReasonLabel } from './labels';

const REASONS = Object.keys(reportReasonLabel) as ReportReason[];

/** Disclosure that files a report. Hidden when signed out; the server enforces auth regardless. */
export function ReportButton({
  targetType,
  targetId,
}: {
  targetType: ReportTargetType;
  targetId: string;
}) {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>('abuse');
  const [details, setDetails] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const formId = `report-${targetType}-${targetId}`;

  if (auth.status !== 'signedIn') return null;
  if (sent) {
    return (
      <p role="status" className="text-sm text-muted">
        Thanks. A moderator will review your report.
      </p>
    );
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiSend('POST', '/api/reports', {
        targetType,
        targetId,
        reason,
        ...(details.trim() ? { details: details.trim() } : {}),
      });
      setSent(true);
    } catch (err) {
      const issues = Object.values(issuesByPath(err));
      setError(
        issues[0] ?? (err instanceof ApiClientError ? err.message : 'Something went wrong.'),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={formId}
        onClick={() => setOpen((o) => !o)}
        className="text-sm text-muted underline underline-offset-4 hover:text-text"
      >
        Report
      </button>
      {open && (
        <form
          id={formId}
          onSubmit={(e) => void onSubmit(e)}
          className="mt-3 max-w-md space-y-3 rounded border border-border p-3"
        >
          <FormError message={error} />
          <Field id={`${formId}-reason`} label="Reason">
            <select
              id={`${formId}-reason`}
              value={reason}
              onChange={(e) => setReason(e.target.value as ReportReason)}
              className={inputClass}
            >
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {reportReasonLabel[r]}
                </option>
              ))}
            </select>
          </Field>
          <Field id={`${formId}-details`} label="Details (optional)">
            <textarea
              id={`${formId}-details`}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={1000}
              rows={3}
              className={inputClass}
            />
          </Field>
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className={secondaryButton}>
              {busy ? 'Sending…' : 'Send report'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className={secondaryButton}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
