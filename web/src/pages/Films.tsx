import { Link, useSearchParams } from 'react-router';
import type { Film, Page } from '../api/types';
import { useApi } from '../api/useApi';
import { FilmImport } from '../components/FilmImport';
import { Poster } from '../components/Poster';
import { EmptyState, ErrorState, Loading } from '../components/StateViews';
import { usePageTitle } from '../usePageTitle';

export function Films() {
  usePageTitle('Films');
  const [params, setParams] = useSearchParams();
  const query = params.get('query') ?? '';
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
  const qs = new URLSearchParams({ page: String(page), ...(query ? { query } : {}) });
  const state = useApi<Page<Film>>(`/api/films?${qs}`);

  return (
    <div>
      <h1 className="font-serif text-3xl">Films</h1>
      <form
        role="search"
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const value = String(new FormData(e.currentTarget).get('query') ?? '').trim();
          setParams(value ? { query: value } : {});
        }}
      >
        <label htmlFor="film-search" className="sr-only">
          Search films by title
        </label>
        <input
          id="film-search"
          name="query"
          type="search"
          defaultValue={query}
          maxLength={100}
          placeholder="Search by title"
          className="w-full rounded border border-border bg-surface px-3 py-2"
        />
        <button
          type="submit"
          className="rounded border border-border px-4 py-2 hover:border-accent"
        >
          Search
        </button>
      </form>

      {state.status === 'loading' && <Loading label="Loading films…" />}
      {state.status === 'error' && <ErrorState message={state.message} onRetry={state.reload} />}
      {state.status === 'success' && state.data.items.length === 0 && (
        <EmptyState title={query ? 'No films match that search' : 'No films in the catalogue yet'}>
          {query ? (
            <p>Try a different title, or search for it below to add it to the catalogue.</p>
          ) : (
            <p>
              The catalogue is seeded by the project team. Run <code>npm run db:seed</code> in a
              development environment.
            </p>
          )}
        </EmptyState>
      )}
      {state.status === 'success' && state.data.items.length > 0 && (
        <>
          <ul className="mt-6 divide-y divide-border rounded border border-border">
            {state.data.items.map((f) => (
              <li key={f.id}>
                <Link
                  to={`/films/${f.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface"
                >
                  <Poster path={f.posterPath} title={f.title} />
                  <span>
                    <span className="font-serif text-lg">{f.title}</span>
                    <span className="ml-2 text-sm text-muted">
                      {[f.releaseYear, f.director].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Pager
            page={state.data.page}
            pageSize={state.data.pageSize}
            total={state.data.total}
            onPage={(p) => setParams({ ...(query ? { query } : {}), page: String(p) })}
          />
        </>
      )}
      <FilmImport initialQuery={query} />
    </div>
  );
}

export function Pager({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center gap-4 text-sm">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className="rounded border border-border px-3 py-1.5 disabled:opacity-40"
      >
        Previous
      </button>
      <span aria-live="polite">
        Page {page} of {pages}
      </span>
      <button
        type="button"
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
        className="rounded border border-border px-3 py-1.5 disabled:opacity-40"
      >
        Next
      </button>
    </nav>
  );
}
