import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { ApiClientError, apiGetAuthed, apiSend } from '../api/client';
import type { Film, MetadataCandidate } from '../api/types';
import { SignInPrompt } from '../auth/RequireAuth';
import { useAuth } from '../auth/AuthContext';
import { FormError, inputClass, secondaryButton } from './Form';
import { Poster } from './Poster';

function describe(err: unknown): string {
  if (err instanceof ApiClientError) {
    if (err.code === 'metadata_unavailable') {
      return 'Searching for new films is not available right now. Try again later.';
    }
    return err.message;
  }
  return 'Something went wrong.';
}

/**
 * Looks a film up on TMDB (through our API) and adds it to the catalogue. The server fetches the
 * metadata itself; the browser only says which film to add.
 */
export function FilmImport({ initialQuery }: { initialQuery: string }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<MetadataCandidate[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (auth.status === 'loading') return null;
  if (auth.status === 'signedOut') {
    return (
      <Section>
        <SignInPrompt what="search for films that are not in the catalogue yet" />
      </Section>
    );
  }

  async function onSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) {
      setError('Type at least 2 characters.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiGetAuthed<{ items: MetadataCandidate[] }>(
        `/api/metadata/search?query=${encodeURIComponent(q)}`,
      );
      setResults(res.items);
    } catch (err) {
      setResults(null);
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  }

  async function add(c: MetadataCandidate) {
    setAdding(c.tmdbId);
    setError(null);
    try {
      const res = await apiSend<{ film: Film }>('POST', '/api/metadata/import', {
        tmdbId: c.tmdbId,
      });
      void navigate(`/films/${res.film.id}`);
    } catch (err) {
      setError(describe(err));
      setAdding(null);
    }
  }

  return (
    <Section>
      <form role="search" onSubmit={(e) => void onSearch(e)} className="flex gap-2">
        <label htmlFor="tmdb-search" className="sr-only">
          Search TMDB for a film
        </label>
        <input
          id="tmdb-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          maxLength={100}
          placeholder="Film title"
          className={`${inputClass} mt-0`}
        />
        <button type="submit" disabled={busy} className={secondaryButton}>
          {busy ? 'Searching…' : 'Search TMDB'}
        </button>
      </form>
      <div className="mt-3 space-y-3">
        <FormError message={error} />
        {results !== null && results.length === 0 && (
          <p className="text-sm text-muted">TMDB has no films matching that title.</p>
        )}
        {results !== null && results.length > 0 && (
          <ul className="divide-y divide-border rounded border border-border">
            {results.map((c) => (
              <li key={c.tmdbId} className="flex items-center gap-3 p-3">
                <Poster path={c.posterPath} title={c.title} />
                <div className="min-w-0 flex-1">
                  <p className="font-serif text-lg">{c.title}</p>
                  <p className="text-sm text-muted">{c.releaseYear ?? 'Year unknown'}</p>
                </div>
                {c.filmId ? (
                  <Link to={`/films/${c.filmId}`} className="text-sm text-accent underline">
                    Already here: open
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled={adding !== null}
                    onClick={() => void add(c)}
                    className={secondaryButton}
                    aria-label={`Add ${c.title}${c.releaseYear ? ` (${c.releaseYear})` : ''} to the catalogue`}
                  >
                    {adding === c.tmdbId ? 'Adding…' : 'Add to catalogue'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}

function Section({ children }: { children: ReactNode }) {
  return (
    <section aria-labelledby="tmdb-heading" className="mt-10 border-t border-border pt-6">
      <h2 id="tmdb-heading" className="font-serif text-2xl">
        Can&rsquo;t find a film?
      </h2>
      <p className="mb-4 mt-1 text-sm text-muted">
        Search The Movie Database and add the film here so people can write about it.
      </p>
      {children}
    </section>
  );
}
