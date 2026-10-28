import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { apiSend } from '../api/client';
import type { InterpretationDetail as Detail } from '../api/types';
import { useApi } from '../api/useApi';
import { useAuth } from '../auth/AuthContext';
import { SpoilerBadge, TypeBadge } from '../components/Badges';
import { ConfirmButton } from '../components/ConfirmButton';
import { CounterReadingForm } from '../components/CounterReadingForm';
import { EvidenceList } from '../components/EvidenceList';
import { plural } from '../components/labels';
import { ReportButton } from '../components/ReportButton';
import { SpoilerGate } from '../components/SpoilerGate';
import { EmptyState, ErrorState, Loading } from '../components/StateViews';
import { secondaryButton } from '../components/Form';
import { usePageTitle } from '../usePageTitle';

export function InterpretationDetail() {
  const { interpretationId = '' } = useParams();
  // Remount per interpretation so a reveal never carries over to another page.
  return <Inner key={interpretationId} id={interpretationId} />;
}

function Inner({ id }: { id: string }) {
  const [reveal, setReveal] = useState(false);
  const auth = useAuth();
  const navigate = useNavigate();
  const state = useApi<{ interpretation: Detail }>(
    `/api/interpretations/${encodeURIComponent(id)}${reveal ? '?reveal=true' : ''}`,
  );
  usePageTitle('Interpretation');

  if (state.status === 'loading' && !reveal) return <Loading label="Loading interpretation…" />;
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
        <p>It may have been removed, or the link may be wrong.</p>
      </EmptyState>
    ) : (
      <ErrorState message={state.message} onRetry={state.reload} />
    );
  }
  if (state.status === 'loading') return <Loading label="Revealing…" />;

  const i = state.data.interpretation;
  // Display only: the server enforces ownership on every edit/delete.
  const isMine = (username: string) =>
    auth.status === 'signedIn' && auth.user?.username === username;
  if (i.concealed) {
    return (
      <div>
        <BackLink filmId={i.filmId} />
        <div className="mt-4">
          <SpoilerGate level={i.spoilerLevel} loading={false} onReveal={() => setReveal(true)} />
        </div>
      </div>
    );
  }

  return (
    <article>
      <BackLink filmId={i.filmId} />
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <TypeBadge type={i.interpretationType} />
        <SpoilerBadge level={i.spoilerLevel} />
      </div>
      <h1 className="mt-3 font-serif text-4xl leading-tight">{i.title}</h1>
      <p className="mt-1 text-sm text-muted">
        by{' '}
        <Link to={`/profile/${i.author.username}`} className="underline">
          {i.author.displayName ?? i.author.username}
        </Link>{' '}
        · <time dateTime={i.createdAt}>{new Date(i.createdAt).toLocaleDateString()}</time>
      </p>

      <section aria-labelledby="claim" className="mt-8">
        <h2 id="claim" className="text-xs uppercase tracking-wide text-muted">
          Claim
        </h2>
        <p className="mt-2 max-w-prose whitespace-pre-line font-serif text-xl leading-relaxed">
          {i.claim}
        </p>
      </section>

      <div className="mt-4 flex flex-wrap items-start gap-3">
        {isMine(i.author.username) ? (
          <>
            <Link to={`/interpretations/${i.id}/edit`} className={secondaryButton}>
              Edit
            </Link>
            <ConfirmButton
              label="Delete"
              prompt="Delete this interpretation? It disappears from the site, including its counter-readings."
              confirmLabel="Yes, delete it"
              onConfirm={async () => {
                await apiSend('DELETE', `/api/interpretations/${i.id}`);
                void navigate(`/films/${i.filmId}`);
              }}
            />
          </>
        ) : (
          <ReportButton targetType="interpretation" targetId={i.id} />
        )}
      </div>

      <section aria-labelledby="evidence" className="mt-8">
        <h2 id="evidence" className="text-xs uppercase tracking-wide text-muted">
          Evidence ({i.evidence.length})
        </h2>
        <div className="mt-3">
          <EvidenceList evidence={i.evidence} heading="Evidence for this claim" />
        </div>
      </section>

      <section aria-labelledby="counters" className="mt-10">
        <h2 id="counters" className="font-serif text-2xl">
          Counter-readings ({i.counterReadings.length})
        </h2>
        {i.counterReadings.length === 0 ? (
          <EmptyState title="No counter-readings yet">
            <p>
              A counter-reading is a different interpretation of the same material, with its own
              evidence.
            </p>
          </EmptyState>
        ) : (
          <ul className="mt-4 space-y-4">
            {i.counterReadings.map((c) => (
              <li key={c.id} className="rounded border border-border bg-surface p-4">
                <p className="text-sm text-muted">
                  <Link to={`/profile/${c.author.username}`} className="underline">
                    {c.author.displayName ?? c.author.username}
                  </Link>{' '}
                  · {plural(c.evidence.length, 'piece')} of evidence
                </p>
                <p className="mt-2 max-w-prose whitespace-pre-line">{c.body}</p>
                {c.evidence.length > 0 && (
                  <div className="mt-3">
                    <EvidenceList
                      evidence={c.evidence}
                      heading="Evidence for this counter-reading"
                    />
                  </div>
                )}
                <div className="mt-3">
                  {isMine(c.author.username) ? (
                    <ConfirmButton
                      label="Delete my counter-reading"
                      prompt="Delete this counter-reading?"
                      confirmLabel="Yes, delete it"
                      onConfirm={async () => {
                        await apiSend('DELETE', `/api/counter-readings/${c.id}`);
                        state.reload();
                      }}
                    />
                  ) : (
                    <ReportButton targetType="counter_reading" targetId={c.id} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <CounterReadingForm interpretationId={i.id} onCreated={state.reload} />
      </section>
    </article>
  );
}

function BackLink({ filmId }: { filmId: string }) {
  return (
    <p className="text-sm text-muted">
      <Link to={`/films/${filmId}`} className="underline">
        Back to film
      </Link>
    </p>
  );
}
