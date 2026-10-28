import { useState } from 'react';
import { Link } from 'react-router';
import { ApiClientError, apiSend } from '../api/client';
import type { ModerationAction, ModerationReport, Page } from '../api/types';
import { useApi } from '../api/useApi';
import { useAuth } from '../auth/AuthContext';
import { Field, FormError, inputClass, secondaryButton } from '../components/Form';
import { reportReasonLabel } from '../components/labels';
import { EmptyState, ErrorState, Loading } from '../components/StateViews';
import { usePageTitle } from '../usePageTitle';

type Tab = 'open' | 'actioned';

const ACTION_LABEL: Record<ModerationAction, string> = {
  dismiss: 'Dismiss report',
  hide: 'Hide content',
  remove: 'Remove content',
};

const STATUS_LABEL = { published: 'Published', hidden: 'Hidden', removed: 'Removed' } as const;

export function Moderation() {
  usePageTitle('Moderation');
  const auth = useAuth();
  const [tab, setTab] = useState<Tab>('open');
  if (auth.status === 'loading' || (auth.status === 'signedIn' && auth.user?.role === null)) {
    return <Loading label="Checking permissions…" />;
  }
  // The server enforces this too; this only avoids showing a page that would 403.
  if (auth.user?.role !== 'moderator' && auth.user?.role !== 'admin') {
    return (
      <EmptyState title="Moderators only">
        <p>You do not have access to the moderation queue.</p>
      </EmptyState>
    );
  }

  return (
    <div>
      <h1 className="font-serif text-4xl">Moderation</h1>
      <p className="mt-2 max-w-prose text-muted">
        Hidden or removed content disappears from public pages. Every decision, including a restore,
        is logged. See the{' '}
        <Link to="/guidelines" className="text-accent underline">
          community guidelines
        </Link>
        .
      </p>
      <nav aria-label="Moderation views" className="mt-6 flex gap-2">
        {(['open', 'actioned'] as const).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
            className={`rounded border px-3 py-1.5 text-sm ${
              tab === t ? 'border-accent text-accent' : 'border-border text-muted'
            }`}
          >
            {t === 'open' ? 'Open reports' : 'Handled'}
          </button>
        ))}
      </nav>
      {/* key remounts the list so paging never carries across tabs */}
      <Queue key={tab} tab={tab} />
    </div>
  );
}

function Queue({ tab }: { tab: Tab }) {
  const [page, setPage] = useState(1);
  const state = useApi<Page<ModerationReport>>(
    `/api/moderation/reports?status=${tab}&page=${page}`,
    { auth: true },
  );

  return (
    <div>
      {state.status === 'loading' && <Loading label="Loading reports…" />}
      {state.status === 'error' && <ErrorState message={state.message} onRetry={state.reload} />}
      {state.status === 'success' && state.data.items.length === 0 && (
        <EmptyState title={tab === 'open' ? 'No open reports' : 'Nothing handled yet'}>
          <p>
            {tab === 'open'
              ? 'Nothing needs review right now.'
              : 'Content you hide or remove after a report will appear here, where it can be restored.'}
          </p>
        </EmptyState>
      )}
      {state.status === 'success' && state.data.items.length > 0 && (
        <>
          <p className="mt-4 text-sm text-muted">
            {state.data.total} {tab === 'open' ? 'open' : 'handled'}
          </p>
          <ul className="mt-4 space-y-4">
            {state.data.items.map((r) => (
              <ReportItem key={r.id} report={r} tab={tab} onChanged={state.reload} />
            ))}
          </ul>
          <div className="mt-6 flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className={secondaryButton}
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page * state.data.pageSize >= state.data.total}
              onClick={() => setPage((p) => p + 1)}
              className={secondaryButton}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ReportItem({
  report,
  tab,
  onChanged,
}: {
  report: ModerationReport;
  tab: Tab;
  onChanged: () => void;
}) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<ModerationAction | 'restore' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: ModerationAction | 'restore') {
    setBusy(kind);
    setError(null);
    const body = note.trim() ? { note: note.trim() } : {};
    try {
      if (kind === 'restore') {
        await apiSend(
          'POST',
          `/api/moderation/content/${report.targetType}/${report.targetId}/restore`,
          body,
        );
      } else {
        await apiSend('POST', `/api/moderation/reports/${report.id}/resolve`, {
          action: kind,
          ...body,
        });
      }
      onChanged();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Something went wrong.');
      setBusy(null);
    }
  }

  const t = report.target;
  const restorable = tab === 'actioned' && t !== null && t.status !== 'published';
  return (
    <li className="rounded border border-border bg-surface p-4">
      <p className="text-sm text-muted">
        {report.targetType === 'interpretation' ? 'Interpretation' : 'Counter-reading'} by{' '}
        {t?.authorUsername ?? 'unknown'} · reported by {report.reporter.username} ·{' '}
        <time dateTime={report.createdAt}>{new Date(report.createdAt).toLocaleString()}</time>
      </p>
      <p className="mt-2 font-medium">{reportReasonLabel[report.reason]}</p>
      {report.details && <p className="mt-1 whitespace-pre-line text-sm">{report.details}</p>}
      {t ? (
        <blockquote className="mt-3 border-l-2 border-border pl-3 text-sm text-muted">
          {t.excerpt}
          <footer className="mt-1">
            Status: <strong>{STATUS_LABEL[t.status]}</strong>
            {t.status === 'published' && (
              <>
                {' '}
                ·{' '}
                <Link
                  to={`/interpretations/${t.interpretationId}`}
                  className="text-accent underline"
                >
                  Open in context
                </Link>
              </>
            )}
          </footer>
        </blockquote>
      ) : (
        <p className="mt-3 text-sm text-muted">The reported content no longer exists.</p>
      )}
      {(tab === 'open' || restorable) && (
        <div className="mt-4 space-y-3">
          <FormError message={error} />
          <Field id={`note-${report.id}`} label="Note (optional, kept in the audit log)">
            <input
              id={`note-${report.id}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
              className={inputClass}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            {tab === 'open' ? (
              (Object.keys(ACTION_LABEL) as ModerationAction[]).map((a) => (
                <button
                  key={a}
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void run(a)}
                  className={secondaryButton}
                >
                  {busy === a ? 'Saving…' : ACTION_LABEL[a]}
                </button>
              ))
            ) : (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void run('restore')}
                className={secondaryButton}
              >
                {busy === 'restore' ? 'Restoring…' : 'Restore content'}
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
