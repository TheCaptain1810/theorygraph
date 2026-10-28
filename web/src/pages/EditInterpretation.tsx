import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiClientError, apiSend } from '../api/client';
import type {
  Evidence,
  InterpretationDetail,
  InterpretationType,
  SpoilerLevel,
} from '../api/types';
import { useApi } from '../api/useApi';
import { useAuth } from '../auth/AuthContext';
import { EvidenceEditor } from '../components/EvidenceEditor';
import {
  isRowBlank,
  newEvidenceRow,
  toPayload,
  validateRows,
  type EvidenceRow,
} from '../components/evidenceForm';
import { EvidenceList } from '../components/EvidenceList';
import {
  Field,
  FormError,
  describedBy,
  inputClass,
  issuesByPath,
  primaryButton,
} from '../components/Form';
import { spoilerLabel, typeLabel } from '../components/labels';
import { EmptyState, ErrorState, Loading } from '../components/StateViews';
import { usePageTitle } from '../usePageTitle';

type Full = Extract<InterpretationDetail, { concealed: false }>;

const TYPES = Object.keys(typeLabel) as InterpretationType[];
const SPOILERS = Object.keys(spoilerLabel) as SpoilerLevel[];

export function EditInterpretation() {
  usePageTitle('Edit interpretation');
  const { interpretationId = '' } = useParams();
  const auth = useAuth();
  // The author is editing their own text, so ask for the full (revealed) version.
  const state = useApi<{ interpretation: InterpretationDetail }>(
    `/api/interpretations/${encodeURIComponent(interpretationId)}?reveal=true`,
  );

  if (state.status === 'loading' || auth.user?.username == null) {
    return <Loading label="Loading…" />;
  }
  if (state.status === 'error') {
    return state.notFound ? (
      <EmptyState
        title="Interpretation not found"
        action={
          <Link to="/films" className="text-accent underline">
            Browse films
          </Link>
        }
      >
        <p>It may have been removed.</p>
      </EmptyState>
    ) : (
      <ErrorState message={state.message} onRetry={state.reload} />
    );
  }
  const i = state.data.interpretation;
  if (i.concealed || i.author.username !== auth.user.username) {
    return (
      <EmptyState
        title="You can only edit your own interpretations"
        action={
          <Link to={`/interpretations/${interpretationId}`} className="text-accent underline">
            Back to the interpretation
          </Link>
        }
      >
        <p>To disagree, add a counter-reading with your own evidence instead.</p>
      </EmptyState>
    );
  }
  return <EditForms interpretation={i} />;
}

function EditForms({ interpretation: i }: { interpretation: Full }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState(i.title);
  const [claim, setClaim] = useState(i.claim);
  const [type, setType] = useState<InterpretationType>(i.interpretationType);
  const [spoiler, setSpoiler] = useState<SpoilerLevel>(i.spoilerLevel);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Evidence added on this page. Appended locally so a refetch never discards unsaved edits above.
  const [added, setAdded] = useState<Evidence[]>([]);
  const allEvidence = [...i.evidence, ...added];

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (!title.trim()) found.title = 'Give your interpretation a title.';
    if (!claim.trim()) found.claim = 'State your claim.';
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) return;

    const patch = {
      ...(title.trim() !== i.title ? { title: title.trim() } : {}),
      ...(claim.trim() !== i.claim ? { claim: claim.trim() } : {}),
      ...(type !== i.interpretationType ? { interpretationType: type } : {}),
      ...(spoiler !== i.spoilerLevel ? { spoilerLevel: spoiler } : {}),
    };
    if (Object.keys(patch).length === 0) {
      setFormError('Nothing has changed yet.');
      return;
    }
    setBusy(true);
    try {
      await apiSend('PATCH', `/api/interpretations/${i.id}`, patch);
      void navigate(`/interpretations/${i.id}`);
    } catch (err) {
      const issues = issuesByPath(err);
      setErrors(issues);
      setFormError(
        err instanceof ApiClientError && Object.keys(issues).length === 0
          ? err.message
          : 'Please fix the highlighted fields.',
      );
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="text-sm text-muted">
        <Link to={`/interpretations/${i.id}`} className="underline">
          Back to the interpretation
        </Link>
      </p>
      <h1 className="mt-2 font-serif text-4xl">Edit interpretation</h1>
      <p className="mt-2 max-w-prose text-sm text-muted">
        Editing changes the text everyone sees. Counter-readings written against the earlier wording
        stay in place, so keep the claim recognisably the same, or publish a new interpretation.
      </p>

      <form onSubmit={(e) => void onSave(e)} className="mt-8 max-w-2xl space-y-6" noValidate>
        <FormError message={formError} />
        <Field id="e-title" label="Title" error={errors.title}>
          <input
            id="e-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={160}
            aria-invalid={!!errors.title}
            aria-describedby={describedBy('e-title', false, errors.title)}
            className={inputClass}
          />
        </Field>
        <Field id="e-claim" label="Main claim" error={errors.claim}>
          <textarea
            id="e-claim"
            value={claim}
            onChange={(e) => setClaim(e.target.value)}
            maxLength={8000}
            rows={6}
            aria-invalid={!!errors.claim}
            aria-describedby={describedBy('e-claim', false, errors.claim)}
            className={inputClass}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="e-type" label="Type">
            <select
              id="e-type"
              value={type}
              onChange={(e) => setType(e.target.value as InterpretationType)}
              className={inputClass}
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {typeLabel[t]}
                </option>
              ))}
            </select>
          </Field>
          <Field id="e-spoiler" label="Spoiler level">
            <select
              id="e-spoiler"
              value={spoiler}
              onChange={(e) => setSpoiler(e.target.value as SpoilerLevel)}
              className={inputClass}
            >
              {SPOILERS.map((s) => (
                <option key={s} value={s}>
                  {spoilerLabel[s]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <button type="submit" disabled={busy} className={primaryButton}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </form>

      <section aria-labelledby="e-evidence" className="mt-12 max-w-2xl">
        <h2 id="e-evidence" className="font-serif text-2xl">
          Evidence ({allEvidence.length})
        </h2>
        <div className="mt-3">
          <EvidenceList evidence={allEvidence} heading="Current evidence" />
        </div>
        <AddEvidence interpretationId={i.id} onAdded={(e) => setAdded((a) => [...a, ...e])} />
      </section>
    </div>
  );
}

function AddEvidence({
  interpretationId,
  onAdded,
}: {
  interpretationId: string;
  onAdded: (evidence: Evidence[]) => void;
}) {
  const [rows, setRows] = useState<EvidenceRow[]>(() => [newEvidenceRow('observation')]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const used = rows.filter((r) => !isRowBlank(r));
    setNotice(null);
    setFormError(null);
    if (used.length === 0) {
      setFormError('Fill in at least one piece of evidence.');
      return;
    }
    const found = validateRows(used);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setFormError('Please fix the highlighted fields.');
      return;
    }
    setBusy(true);
    const payload = toPayload(used);
    let saved = 0;
    const created: Evidence[] = [];
    try {
      // One request per item (the API adds evidence singly). Stop at the first failure.
      for (const item of payload) {
        const res = await apiSend<{ evidence: Evidence }>(
          'POST',
          `/api/interpretations/${interpretationId}/evidence`,
          item,
        );
        created.push(res.evidence);
        saved += 1;
      }
      setRows([newEvidenceRow('observation')]);
      setErrors({});
      setNotice(`Added ${saved} piece${saved === 1 ? '' : 's'} of evidence.`);
      onAdded(created);
    } catch (err) {
      // Keep only the rows that did not save, so a retry never duplicates evidence.
      const remaining = used.slice(saved);
      setRows(remaining);
      const issues = issuesByPath(err);
      // Server paths are relative to a single item; re-key to the remaining first row.
      setErrors(Object.fromEntries(Object.entries(issues).map(([k, v]) => [`evidence.0.${k}`, v])));
      setFormError(
        (saved > 0 ? `${saved} saved before an error. ` : '') +
          (err instanceof ApiClientError ? err.message : 'Something went wrong.'),
      );
      if (saved > 0) onAdded(created);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-4" noValidate>
      <h3 className="font-serif text-xl">Add evidence</h3>
      {notice && (
        <p role="status" className="text-sm text-accent">
          {notice}
        </p>
      )}
      <FormError message={formError} />
      <EvidenceEditor
        idPrefix="add-ev"
        rows={rows}
        onChange={setRows}
        errors={errors}
        minRows={1}
      />
      <button type="submit" disabled={busy} className={primaryButton}>
        {busy ? 'Adding…' : 'Add evidence'}
      </button>
    </form>
  );
}
