import { useState, type FormEvent } from 'react';
import { ApiClientError, apiSend } from '../api/client';
import { SignInPrompt } from '../auth/RequireAuth';
import { useAuth } from '../auth/AuthContext';
import { EvidenceEditor } from './EvidenceEditor';
import { isRowBlank, toPayload, validateRows, type EvidenceRow } from './evidenceForm';
import { Field, FormError, describedBy, inputClass, issuesByPath, primaryButton } from './Form';

/** Adds a counter-reading to a published interpretation. Evidence is optional but encouraged. */
export function CounterReadingForm({
  interpretationId,
  onCreated,
}: {
  interpretationId: string;
  onCreated: () => void;
}) {
  const auth = useAuth();
  const [body, setBody] = useState('');
  const [rows, setRows] = useState<EvidenceRow[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (auth.status === 'loading') return null;
  if (auth.status === 'signedOut') {
    return <SignInPrompt what="add a counter-reading" />;
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const used = rows.filter((r) => !isRowBlank(r));
    const found: Record<string, string> = {};
    if (!body.trim()) found.body = 'Describe your alternative reading.';
    Object.assign(found, validateRows(used));
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) {
      setFormError('Please fix the highlighted fields.');
      return;
    }
    setBusy(true);
    try {
      await apiSend(
        'POST',
        `/api/interpretations/${encodeURIComponent(interpretationId)}/counter-readings`,
        {
          body: body.trim(),
          ...(used.length ? { evidence: toPayload(used) } : {}),
        },
      );
      setBody('');
      setRows([]);
      setDone(true);
      onCreated();
    } catch (err) {
      const issues = issuesByPath(err);
      setErrors(issues);
      setFormError(
        err instanceof ApiClientError && Object.keys(issues).length === 0
          ? err.message
          : err instanceof ApiClientError
            ? 'Please fix the highlighted fields.'
            : 'Something went wrong.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      className="mt-6 space-y-4 rounded border border-border p-4"
      noValidate
      aria-labelledby="add-counter-heading"
    >
      <h3 id="add-counter-heading" className="font-serif text-xl">
        Add a counter-reading
      </h3>
      <p className="text-sm text-muted">
        Offer a different reading of the same material. The original stays visible, and your reading
        can carry its own evidence.
      </p>
      {done && (
        <p role="status" className="text-sm text-accent">
          Your counter-reading was added.
        </p>
      )}
      <FormError message={formError} />
      <Field id="cr-body" label="Your reading" error={errors.body}>
        <textarea
          id="cr-body"
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            setDone(false);
          }}
          maxLength={8000}
          rows={5}
          required
          aria-invalid={!!errors.body}
          aria-describedby={describedBy('cr-body', false, errors.body)}
          className={inputClass}
        />
      </Field>
      <div>
        <h4 className="text-sm font-medium">Evidence for your reading (optional)</h4>
        <div className="mt-3">
          <EvidenceEditor
            idPrefix="cr-ev"
            rows={rows}
            onChange={setRows}
            errors={errors}
            minRows={0}
          />
        </div>
      </div>
      <button type="submit" disabled={busy} className={primaryButton}>
        {busy ? 'Adding…' : 'Add counter-reading'}
      </button>
    </form>
  );
}
