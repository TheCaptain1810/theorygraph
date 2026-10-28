import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ApiClientError, apiSend } from '../api/client';
import type { Film, InterpretationDetail, InterpretationType, SpoilerLevel } from '../api/types';
import { useApi } from '../api/useApi';
import { EvidenceEditor } from '../components/EvidenceEditor';
import {
  isRowBlank,
  newEvidenceRow,
  parseTimestamp,
  toPayload,
  validateRows,
  type EvidenceRow,
} from '../components/evidenceForm';
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

const TYPES = Object.keys(typeLabel) as InterpretationType[];
const SPOILERS = Object.keys(spoilerLabel) as SpoilerLevel[];
const TAG_RE = /^[a-z0-9][a-z0-9 -]{0,38}[a-z0-9]$/;

export function parseTags(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

export function NewInterpretation() {
  usePageTitle('Write an interpretation');
  const [params] = useSearchParams();
  const filmId = params.get('filmId') ?? '';
  const film = useApi<{ film: Film }>(`/api/films/${encodeURIComponent(filmId)}`);

  if (!filmId) {
    return (
      <EmptyState
        title="Choose a film first"
        action={
          <Link to="/films" className="text-accent underline">
            Browse films
          </Link>
        }
      >
        <p>
          Interpretations belong to a film. Open a film and choose “Write the first interpretation”.
        </p>
      </EmptyState>
    );
  }
  if (film.status === 'loading') return <Loading label="Loading film…" />;
  if (film.status === 'error') {
    return film.notFound ? (
      <EmptyState
        title="Film not found"
        action={
          <Link to="/films" className="text-accent underline">
            Browse films
          </Link>
        }
      >
        <p>That film is not in the catalogue.</p>
      </EmptyState>
    ) : (
      <ErrorState message={film.message} onRetry={film.reload} />
    );
  }
  return <InterpretationForm film={film.data.film} />;
}

function InterpretationForm({ film }: { film: Film }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [claim, setClaim] = useState('');
  const [type, setType] = useState<InterpretationType>('interpretation');
  const [spoiler, setSpoiler] = useState<SpoilerLevel>('none');
  const [tags, setTags] = useState('');
  const [rows, setRows] = useState<EvidenceRow[]>(() => [newEvidenceRow('observation')]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const used = rows.filter((r) => !isRowBlank(r));
    const found: Record<string, string> = {};
    if (!title.trim()) found.title = 'Give your interpretation a title.';
    if (!claim.trim()) found.claim = 'State your claim.';
    const tagList = parseTags(tags);
    if (tagList.some((t) => !TAG_RE.test(t))) {
      found.tags = 'Tags are 2–40 letters, numbers, spaces or hyphens, separated by commas.';
    } else if (tagList.length > 8) {
      found.tags = 'Use at most 8 tags.';
    }
    Object.assign(found, validateRows(used));
    const hasObservation = used.some(
      (r) =>
        r.evidenceType === 'observation' ||
        r.sceneDescription.trim() ||
        (parseTimestamp(r.timestamp) ?? NaN) >= 0,
    );
    if (!hasObservation) found.evidence = 'Add at least one observation or scene reference.';

    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) {
      setFormError('Please fix the highlighted fields.');
      return;
    }

    setBusy(true);
    try {
      const res = await apiSend<{
        interpretation: Extract<InterpretationDetail, { concealed: false }>;
      }>('POST', '/api/interpretations', {
        filmId: film.id,
        title: title.trim(),
        claim: claim.trim(),
        interpretationType: type,
        spoilerLevel: spoiler,
        evidence: toPayload(used),
        ...(tagList.length ? { tags: tagList } : {}),
      });
      void navigate(`/interpretations/${res.interpretation.id}`);
    } catch (err) {
      const issues = issuesByPath(err);
      setErrors(issues);
      setFormError(
        err instanceof ApiClientError
          ? Object.keys(issues).length > 0
            ? 'Please fix the highlighted fields.'
            : err.message
          : 'Something went wrong.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="text-sm text-muted">
        <Link to={`/films/${film.id}`} className="underline">
          {film.title}
        </Link>
      </p>
      <h1 className="mt-2 font-serif text-4xl">Write an interpretation</h1>
      <p className="mt-3 max-w-prose text-muted">
        An <strong>observation</strong> is what a viewer can point to: a shot, a line, a sound. An{' '}
        <strong>interpretation</strong> is what you think it means. Keep them apart: state your
        claim, then support it with observations other people can check.
      </p>

      <form onSubmit={(e) => void onSubmit(e)} className="mt-8 max-w-2xl space-y-6" noValidate>
        <FormError message={formError} />

        <Field id="title" label="Title" error={errors.title}>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={160}
            required
            aria-invalid={!!errors.title}
            aria-describedby={describedBy('title', false, errors.title)}
            className={inputClass}
          />
        </Field>

        <Field
          id="claim"
          label="Main claim"
          hint="What do you think this means? Say it as a claim, not a fact."
          error={errors.claim}
        >
          <textarea
            id="claim"
            value={claim}
            onChange={(e) => setClaim(e.target.value)}
            maxLength={8000}
            rows={6}
            required
            aria-invalid={!!errors.claim}
            aria-describedby={describedBy('claim', true, errors.claim)}
            className={inputClass}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="type" label="Type">
            <select
              id="type"
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
          <Field
            id="spoiler"
            label="Spoiler level"
            hint="Major spoilers are hidden from readers until they choose to reveal them."
          >
            <select
              id="spoiler"
              value={spoiler}
              onChange={(e) => setSpoiler(e.target.value as SpoilerLevel)}
              aria-describedby="spoiler-hint"
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

        <Field
          id="tags"
          label="Tags (optional)"
          hint="Comma-separated, up to 8. For example: motif, color, editing."
          error={errors.tags}
        >
          <input
            id="tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            aria-invalid={!!errors.tags}
            aria-describedby={describedBy('tags', true, errors.tags)}
            className={inputClass}
          />
        </Field>

        <section aria-labelledby="evidence-heading">
          <h2 id="evidence-heading" className="font-serif text-2xl">
            Evidence
          </h2>
          <p className="mt-1 text-sm text-muted">
            At least one observation or scene reference is required. Add external sources if they
            help.
          </p>
          {errors.evidence && (
            <p role="alert" className="mt-2 text-sm text-danger">
              {errors.evidence}
            </p>
          )}
          <div className="mt-4">
            <EvidenceEditor
              idPrefix="ev"
              rows={rows}
              onChange={setRows}
              errors={errors}
              minRows={1}
            />
          </div>
        </section>

        <button type="submit" disabled={busy} className={primaryButton}>
          {busy ? 'Publishing…' : 'Publish interpretation'}
        </button>
      </form>
    </div>
  );
}
