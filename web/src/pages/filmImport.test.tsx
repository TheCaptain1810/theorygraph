import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '../auth/AuthContext';
import { FilmImport } from '../components/FilmImport';
import { Poster } from '../components/Poster';

vi.mock('../auth/supabase', () => ({
  authConfigured: true,
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: { access_token: 'tok' } } }),
    },
  },
}));

afterEach(() => vi.restoreAllMocks());

const signedIn: AuthState = {
  status: 'signedIn',
  user: { id: 'u', email: null, username: 'me', role: 'user' },
  configured: true,
  signOut: async () => {},
};
const signedOut: AuthState = { ...signedIn, status: 'signedOut', user: null };

const json = (body: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );

function renderImport(auth: AuthState, initialQuery = 'metropolis') {
  return render(
    <MemoryRouter initialEntries={['/films']}>
      <AuthContext.Provider value={auth}>
        <Routes>
          <Route path="/films" element={<FilmImport initialQuery={initialQuery} />} />
          <Route path="/films/:filmId" element={<p>Film page</p>} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

const candidates = {
  items: [
    { tmdbId: 19, title: 'Metropolis', releaseYear: 1927, posterPath: '/a.jpg', filmId: null },
    {
      tmdbId: 9606,
      title: 'Metropolis',
      releaseYear: 2001,
      posterPath: null,
      filmId: 'film-existing',
    },
  ],
};

describe('Poster', () => {
  it('renders a TMDB image with alt text for a safe path', () => {
    render(<Poster path="/abc_1-2.jpg" title="Metropolis" />);
    const img = screen.getByRole('img', { name: 'Poster of Metropolis' });
    expect(img).toHaveAttribute('src', 'https://image.tmdb.org/t/p/w92/abc_1-2.jpg');
    expect(img).toHaveAttribute('loading', 'lazy');
  });

  it.each([
    null,
    '',
    '/x.jpg?q=1',
    '//evil.example/a.jpg',
    '/../a.jpg',
    'https://evil.example/a.jpg',
  ])('renders nothing for %j', (path) => {
    const { container } = render(<Poster path={path} title="X" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('FilmImport', () => {
  it('asks signed-out visitors to sign in and makes no request', () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    renderImport(signedOut);
    expect(screen.getByRole('link', { name: /log in/i })).toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('searches with the bearer token and links films that are already in the catalogue', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => json(candidates));
    renderImport(signedIn);
    await userEvent.click(screen.getByRole('button', { name: 'Search TMDB' }));
    expect(await screen.findByText('1927')).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain('/api/metadata/search?query=metropolis');
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(screen.getByRole('link', { name: /already here/i })).toHaveAttribute(
      'href',
      '/films/film-existing',
    );
    expect(screen.getAllByRole('button', { name: /to the catalogue/i })).toHaveLength(1);
  });

  it('adds only the chosen TMDB id and opens the new film page', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((_u, init) =>
        init?.method === 'POST'
          ? json({ film: { id: 'new-film' }, created: true }, 201)
          : json(candidates),
      );
    renderImport(signedIn);
    await userEvent.click(screen.getByRole('button', { name: 'Search TMDB' }));
    await userEvent.click(await screen.findByRole('button', { name: /add metropolis \(1927\)/i }));
    expect(await screen.findByText('Film page')).toBeInTheDocument();
    const post = fetchMock.mock.calls.find(([, i]) => i?.method === 'POST')!;
    expect(JSON.parse(String(post[1]!.body))).toEqual({ tmdbId: 19 }); // never title/poster
  });

  it('validates short queries without calling the API', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    renderImport(signedIn, 'a');
    await userEvent.click(screen.getByRole('button', { name: 'Search TMDB' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('at least 2 characters');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows a friendly message when the metadata service is unavailable', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      json({ error: { code: 'metadata_unavailable', message: 'x' } }, 502),
    );
    renderImport(signedIn);
    await userEvent.click(screen.getByRole('button', { name: 'Search TMDB' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('not available right now');
  });

  it('says so when TMDB has no match', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => json({ items: [] }));
    renderImport(signedIn);
    await userEvent.click(screen.getByRole('button', { name: 'Search TMDB' }));
    expect(await screen.findByText(/no films matching/i)).toBeInTheDocument();
  });
});
