import { Link, useParams, useSearchParams } from 'react-router';
import type { Film, InterpretationSummary, Page } from '../api/types';
import { useApi } from '../api/useApi';
import { InterpretationCard } from '../components/InterpretationCard';
import { Poster } from '../components/Poster';
import { EmptyState, ErrorState, Loading } from '../components/StateViews';
import { usePageTitle } from '../usePageTitle';
import { Pager } from './Films';

export function FilmDetail() {
  const { filmId = '' } = useParams();
  const film = useApi<{ film: Film }>(`/api/films/${encodeURIComponent(filmId)}`);
  usePageTitle(film.status === 'success' ? film.data.film.title : 'Film');

  if (film.status === 'loading') return <Loading label="Loading film…" />;
  if (film.status === 'error') {
    return film.notFound ? (
      <EmptyState
        title="Film not found"
        action={
          <Link to="/films" className="text-accent underline">
            Back to films
          </Link>
        }
      >
        <p>That film is not in the catalogue.</p>
      </EmptyState>
    ) : (
      <ErrorState message={film.message} onRetry={film.reload} />
    );
  }
  const f = film.data.film;
  return (
    <div>
      <p className="text-sm text-muted">
        <Link to="/films" className="underline">
          Films
        </Link>
      </p>
      <div className="mt-2 flex items-start gap-5">
        <Poster path={f.posterPath} title={f.title} size="large" />
        <div>
          <h1 className="font-serif text-4xl">{f.title}</h1>
          <p className="mt-1 text-muted">
            {[f.releaseYear, f.director && `Directed by ${f.director}`].filter(Boolean).join(' · ')}
          </p>
          {f.metadataAttribution && (
            <p className="mt-1 text-xs text-muted">Metadata: {f.metadataAttribution}</p>
          )}
        </div>
      </div>

      <p className="mt-6 max-w-2xl text-muted">
        Interpretations below are readings, not facts. Each one links to the observations that
        support it, and any reader can add a counter-reading.
      </p>

      <Interpretations filmId={f.id} />
    </div>
  );
}

function Interpretations({ filmId }: { filmId: string }) {
  const [params, setParams] = useSearchParams();
  const tag = params.get('tag') ?? '';
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
  const qs = new URLSearchParams({ page: String(page), ...(tag ? { tag } : {}) });
  const state = useApi<Page<InterpretationSummary>>(
    `/api/films/${encodeURIComponent(filmId)}/interpretations?${qs}`,
  );

  return (
    <section aria-labelledby="interps" className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="interps" className="font-serif text-2xl">
          Interpretations
        </h2>
        <form
          role="search"
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = String(new FormData(e.currentTarget).get('tag') ?? '')
              .trim()
              .toLowerCase();
            setParams(v ? { tag: v } : {});
          }}
        >
          <div>
            <label htmlFor="tag-filter" className="block text-xs text-muted">
              Filter by tag
            </label>
            <input
              id="tag-filter"
              name="tag"
              defaultValue={tag}
              maxLength={40}
              className="rounded border border-border bg-surface px-2 py-1"
            />
          </div>
          <button
            type="submit"
            className="rounded border border-border px-3 py-1.5 text-sm hover:border-accent"
          >
            Apply
          </button>
        </form>
      </div>

      {state.status === 'loading' && <Loading label="Loading interpretations…" />}
      {state.status === 'error' && <ErrorState message={state.message} onRetry={state.reload} />}
      {state.status === 'success' && state.data.items.length === 0 && (
        <EmptyState
          title={tag ? `Nothing tagged “${tag}” yet` : 'No interpretations yet'}
          action={
            <Link
              to={`/new/interpretation?filmId=${encodeURIComponent(filmId)}`}
              className="rounded bg-accent px-4 py-2 font-medium text-bg"
            >
              Write the first interpretation
            </Link>
          }
        >
          <p>
            An interpretation links a claim about the film to specific observations. Add one, or
            come back when someone has.
          </p>
        </EmptyState>
      )}
      {state.status === 'success' && state.data.items.length > 0 && (
        <>
          <p className="mt-4">
            <Link
              to={`/new/interpretation?filmId=${encodeURIComponent(filmId)}`}
              className="inline-block rounded bg-accent px-4 py-2 font-medium text-bg"
            >
              Write an interpretation
            </Link>
          </p>
          <ul className="mt-4 space-y-4">
            {state.data.items.map((i) => (
              <InterpretationCard key={i.id} item={i} />
            ))}
          </ul>
          <Pager
            page={state.data.page}
            pageSize={state.data.pageSize}
            total={state.data.total}
            onPage={(p) => setParams({ ...(tag ? { tag } : {}), page: String(p) })}
          />
        </>
      )}
    </section>
  );
}
