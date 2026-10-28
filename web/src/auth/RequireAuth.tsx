import type { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { EmptyState, Loading } from '../components/StateViews';
import { useAuth } from './AuthContext';

/** Only same-site relative paths are accepted as a post-login destination (no open redirects). */
export function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/films';
}

/** Gate for authenticated pages. The server still enforces auth on every write. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const location = useLocation();
  if (auth.status === 'loading') return <Loading label="Checking your session…" />;
  if (!auth.configured) {
    return (
      <EmptyState title="Sign-in is not available">
        <p>This deployment has no authentication configured yet.</p>
      </EmptyState>
    );
  }
  if (auth.status === 'signedOut') {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <>{children}</>;
}

export function SignInPrompt({ what }: { what: string }) {
  const location = useLocation();
  const next = encodeURIComponent(location.pathname + location.search);
  return (
    <p className="text-sm text-muted">
      <Link to={`/login?next=${next}`} className="text-accent underline">
        Log in
      </Link>{' '}
      or{' '}
      <Link to={`/signup?next=${next}`} className="text-accent underline">
        sign up
      </Link>{' '}
      to {what}.
    </p>
  );
}
