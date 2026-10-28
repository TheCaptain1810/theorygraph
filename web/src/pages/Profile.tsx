import { Link, useParams, useSearchParams } from 'react-router';
import type { ProfileCounterReading, ProfileResponse } from '../api/types';
import { useApi } from '../api/useApi';
import { SpoilerBadge } from '../components/Badges';
import { InterpretationCard } from '../components/InterpretationCard';
import { plural } from '../components/labels';
import { EmptyState, ErrorState, Loading } from '../components/StateViews';
import { usePageTitle } from '../usePageTitle';
import { Pager } from './Films';

export function Profile() {
  const { username = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
  const state = useApi<ProfileResponse>(`/api/users/${encodeURIComponent(username)}?page=${page}`);
  usePageTitle(state.status === 'success' ? `@${state.data.user.username}` : 'Profile');

  if (state.status === 'loading') return <Loading label="Loading profile…" />;
  if (state.status === 'error') {
    return state.notFound ? (
      <EmptyState
        title="User not found"
        action={
          <Link to="/films" className="text-accent underline">
            Browse films
          </Link>
        }
      >
        <p>There is no user with that name.</p>
      </EmptyState>
    ) : (
      <ErrorState message={state.message} onRetry={state.reload} />
    );
  }

  const { user, interpretations, counterReadings } = state.data;
  return (
    <div>
      <h1 className="font-serif text-4xl">{user.displayName ?? user.username}</h1>
      <p className="mt-1 text-muted">
        @{user.username} · joined{' '}
        <time dateTime={user.joinedAt}>{new Date(user.joinedAt).toLocaleDateString()}</time>
      </p>
      {user.bio && <p className="mt-3 max-w-prose whitespace-pre-line">{user.bio}</p>}

      <section aria-labelledby="p-interps" className="mt-10">
        <h2 id="p-interps" className="font-serif text-2xl">
          Interpretations ({interpretations.total})
        </h2>
        {interpretations.items.length === 0 ? (
          <EmptyState title="No interpretations yet">
            <p>This person has not published an interpretation.</p>
          </EmptyState>
        ) : (
          <>
            <ul className="mt-4 space-y-4">
              {interpretations.items.map((i) => (
                <InterpretationCard key={i.id} item={i} filmTitle={i.filmTitle} />
              ))}
            </ul>
            <Pager
              page={interpretations.page}
              pageSize={interpretations.pageSize}
              total={interpretations.total}
              onPage={(p) => setParams({ page: String(p) })}
            />
          </>
        )}
      </section>

      <section aria-labelledby="p-counters" className="mt-10">
        <h2 id="p-counters" className="font-serif text-2xl">
          Counter-readings ({counterReadings.total})
        </h2>
        {counterReadings.items.length === 0 ? (
          <EmptyState title="No counter-readings yet">
            <p>This person has not offered an alternative reading.</p>
          </EmptyState>
        ) : (
          <>
            <ul className="mt-4 space-y-4">
              {counterReadings.items.map((c) => (
                <CounterReadingItem key={c.id} item={c} />
              ))}
            </ul>
            {counterReadings.total > counterReadings.items.length && (
              <p className="mt-3 text-sm text-muted">
                Showing the latest {plural(counterReadings.items.length, 'counter-reading')}.
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function CounterReadingItem({ item }: { item: ProfileCounterReading }) {
  return (
    <li className="rounded border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
        <span>On {item.filmTitle}</span>
        <SpoilerBadge level={item.spoilerLevel} />
      </div>
      {item.concealed ? (
        <p className="mt-2 font-serif text-lg">
          Concealed: the interpretation it answers has major spoilers
        </p>
      ) : (
        <p className="mt-2 line-clamp-4 whitespace-pre-line">{item.excerpt}</p>
      )}
      <Link
        to={`/interpretations/${item.interpretationId}`}
        className="mt-3 inline-block text-sm text-accent underline"
      >
        {item.concealed ? 'Open the interpretation (you will be asked first)' : 'Read in context'}
      </Link>
    </li>
  );
}
