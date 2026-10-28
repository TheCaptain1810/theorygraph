import { Link, NavLink, Outlet } from 'react-router';
import { useAuth } from '../auth/AuthContext';

const nav = [
  { to: '/films', label: 'Films' },
  { to: '/guidelines', label: 'Guidelines' },
];

export function Layout() {
  const auth = useAuth();
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:bg-accent focus:px-3 focus:py-2 focus:text-bg"
      >
        Skip to content
      </a>
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <Link to="/" className="font-serif text-xl tracking-wide">
            Theory<span className="text-accent">Graph</span>
          </Link>
          <nav aria-label="Main" className="flex gap-5 text-sm">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  isActive
                    ? 'text-accent underline underline-offset-4'
                    : 'text-muted hover:text-text'
                }
              >
                {n.label}
              </NavLink>
            ))}
            {(auth.user?.role === 'moderator' || auth.user?.role === 'admin') && (
              <NavLink
                to="/moderation"
                className={({ isActive }) =>
                  isActive
                    ? 'text-accent underline underline-offset-4'
                    : 'text-muted hover:text-text'
                }
              >
                Moderation
              </NavLink>
            )}
            {auth.status === 'signedIn' && auth.user ? (
              <>
                {auth.user.username ? (
                  <Link
                    to={`/profile/${auth.user.username}`}
                    className="text-muted hover:text-text"
                    aria-label={`Your profile, signed in as ${auth.user.username}`}
                  >
                    {auth.user.username}
                  </Link>
                ) : (
                  <span className="text-muted">{auth.user.email}</span>
                )}
                <button
                  type="button"
                  onClick={() => void auth.signOut()}
                  className="text-muted underline underline-offset-4 hover:text-text"
                >
                  Log out
                </button>
              </>
            ) : (
              auth.status === 'signedOut' && (
                <>
                  <NavLink to="/login" className="text-muted hover:text-text">
                    Log in
                  </NavLink>
                  <NavLink to="/signup" className="text-muted hover:text-text">
                    Sign up
                  </NavLink>
                </>
              )
            )}
          </nav>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-border">
        <p className="mx-auto max-w-4xl px-4 py-4 text-sm text-muted">
          TheoryGraph is an early pilot. Interpretations are subjective readings, not objective
          truth. Film data and posters are provided by{' '}
          <a
            href="https://www.themoviedb.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            TMDB
          </a>
          . This product uses the TMDB API but is not endorsed or certified by TMDB.
        </p>
      </footer>
    </div>
  );
}
