import type { EvidenceType } from '../api/types';
import { newEvidenceRow, type EvidenceRow } from './evidenceForm';
import { Field, describedBy, inputClass, secondaryButton } from './Form';
import { evidenceLabel } from './labels';

const TYPES: EvidenceType[] = ['observation', 'external_source', 'production_fact'];
const MAX_ROWS = 20;

/**
 * Editable list of evidence rows. `idPrefix` keeps element ids unique when two editors share a page;
 * `errors` is keyed "evidence.<i>.<field>" (client checks and server issues use the same shape).
 */
export function EvidenceEditor({
  idPrefix,
  rows,
  onChange,
  errors,
  minRows,
}: {
  idPrefix: string;
  rows: EvidenceRow[];
  onChange: (rows: EvidenceRow[]) => void;
  errors: Record<string, string>;
  minRows: number;
}) {
  const update = (key: number, patch: Partial<EvidenceRow>) =>
    onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <div>
      {rows.length === 0 && (
        <p className="text-sm text-muted">No evidence added. You can add some below.</p>
      )}
      <ol className="space-y-5">
        {rows.map((r, i) => {
          const id = (f: string) => `${idPrefix}-${r.key}-${f}`;
          const err = (f: string) => errors[`evidence.${i}.${f}`];
          return (
            <li key={r.key} className="rounded border border-border p-4">
              <fieldset>
                <legend className="text-sm font-medium">Evidence {i + 1}</legend>
                <div className="mt-3 space-y-4">
                  <Field id={id('type')} label="Type">
                    <select
                      id={id('type')}
                      value={r.evidenceType}
                      onChange={(e) =>
                        update(r.key, { evidenceType: e.target.value as EvidenceType })
                      }
                      className={inputClass}
                    >
                      {TYPES.map((t) => (
                        <option key={t} value={t}>
                          {evidenceLabel[t]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    id={id('description')}
                    label="What do you point to?"
                    hint="Describe what can be seen or heard, or what the source says. Save what you think it means for your claim."
                    error={err('description')}
                  >
                    <textarea
                      id={id('description')}
                      value={r.description}
                      onChange={(e) => update(r.key, { description: e.target.value })}
                      maxLength={2000}
                      rows={3}
                      aria-invalid={!!err('description')}
                      aria-describedby={describedBy(id('description'), true, err('description'))}
                      className={inputClass}
                    />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      id={id('scene')}
                      label="Scene (optional)"
                      error={err('sceneDescription')}
                    >
                      <input
                        id={id('scene')}
                        value={r.sceneDescription}
                        onChange={(e) => update(r.key, { sceneDescription: e.target.value })}
                        maxLength={500}
                        className={inputClass}
                      />
                    </Field>
                    <Field
                      id={id('time')}
                      label="Timestamp (optional)"
                      hint="e.g. 1:15 or 1:02:05"
                      error={err('timestampSeconds')}
                    >
                      <input
                        id={id('time')}
                        value={r.timestamp}
                        onChange={(e) => update(r.key, { timestamp: e.target.value })}
                        inputMode="numeric"
                        aria-invalid={!!err('timestampSeconds')}
                        aria-describedby={describedBy(id('time'), true, err('timestampSeconds'))}
                        className={inputClass}
                      />
                    </Field>
                  </div>
                  {(r.evidenceType === 'external_source' || r.sourceUrl) && (
                    <Field
                      id={id('url')}
                      label="Source link"
                      hint="http(s) links only."
                      error={err('sourceUrl')}
                    >
                      <input
                        id={id('url')}
                        type="url"
                        value={r.sourceUrl}
                        onChange={(e) => update(r.key, { sourceUrl: e.target.value })}
                        maxLength={2000}
                        aria-invalid={!!err('sourceUrl')}
                        aria-describedby={describedBy(id('url'), true, err('sourceUrl'))}
                        className={inputClass}
                      />
                    </Field>
                  )}
                  {rows.length > minRows && (
                    <button
                      type="button"
                      onClick={() => onChange(rows.filter((x) => x.key !== r.key))}
                      className={secondaryButton}
                    >
                      Remove evidence {i + 1}
                    </button>
                  )}
                </div>
              </fieldset>
            </li>
          );
        })}
      </ol>
      {rows.length < MAX_ROWS && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onChange([...rows, newEvidenceRow('observation')])}
            className={secondaryButton}
          >
            Add observation
          </button>
          <button
            type="button"
            onClick={() => onChange([...rows, newEvidenceRow('external_source')])}
            className={secondaryButton}
          >
            Add external source
          </button>
        </div>
      )}
    </div>
  );
}
