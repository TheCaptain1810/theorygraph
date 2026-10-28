import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { safeNext } from '../auth/RequireAuth';
import { supabase } from '../auth/supabase';
import { Field, FormError, describedBy, inputClass, primaryButton } from '../components/Form';
import { EmptyState, Loading } from '../components/StateViews';
import { usePageTitle } from '../usePageTitle';

const USERNAME_RE = /^[a-z0-9_]{3,24}$/;

function Unavailable() {
  return (
    <EmptyState title="Sign-in is not available">
      <p>This deployment has no authentication configured. Reading is open to everyone.</p>
    </EmptyState>
  );
}

export function LoginPage() {
  usePageTitle('Log in');
  const auth = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (auth.status === 'loading') return <Loading label="Checking your session…" />;
  if (!auth.configured || !supabase) return <Unavailable />;
  if (auth.status === 'signedIn') return <Navigate to={next} replace />;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    const { error: err } = await supabase!.auth.signInWithPassword({
      email: String(form.get('email') ?? '').trim(),
      password: String(form.get('password') ?? ''),
    });
    setBusy(false);
    if (err) {
      // Same wording for every credential failure; do not reveal whether an account exists.
      setError(
        err.message.toLowerCase().includes('email not confirmed')
          ? 'Confirm your email address first. Check your inbox for the link.'
          : 'Email or password is incorrect.',
      );
      return;
    }
    void navigate(next, { replace: true });
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="font-serif text-3xl">Log in</h1>
      <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-4" noValidate>
        <FormError message={error} />
        <Field id="email" label="Email">
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className={inputClass}
          />
        </Field>
        <Field id="password" label="Password">
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className={inputClass}
          />
        </Field>
        <button type="submit" disabled={busy} className={primaryButton}>
          {busy ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p className="mt-6 text-sm text-muted">
        New here?{' '}
        <Link to={`/signup?next=${encodeURIComponent(next)}`} className="text-accent underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}

export function SignupPage() {
  usePageTitle('Sign up');
  const auth = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  if (auth.status === 'loading') return <Loading label="Checking your session…" />;
  if (!auth.configured || !supabase) return <Unavailable />;
  if (auth.status === 'signedIn') return <Navigate to={next} replace />;

  if (checkEmail) {
    return (
      <EmptyState title="Check your email">
        <p>
          We sent a confirmation link. Open it, then{' '}
          <Link to={`/login?next=${encodeURIComponent(next)}`} className="text-accent underline">
            log in
          </Link>
          .
        </p>
      </EmptyState>
    );
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const username = String(form.get('username') ?? '')
      .trim()
      .toLowerCase();
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');

    const found: Record<string, string> = {};
    if (!USERNAME_RE.test(username)) {
      found.username = '3–24 characters: lowercase letters, numbers or underscores.';
    }
    if (!email) found.email = 'Enter your email address.';
    if (password.length < 8) found.password = 'Use at least 8 characters.';
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    const { data, error: err } = await supabase!.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });
    setBusy(false);
    if (err) {
      setFormError(err.message);
      return;
    }
    // With email confirmation on, there is no session yet.
    if (!data.session) {
      setCheckEmail(true);
      return;
    }
    void navigate(next, { replace: true });
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="font-serif text-3xl">Sign up</h1>
      <p className="mt-2 text-sm text-muted">
        Your username is shown publicly next to what you write. Please read the{' '}
        <Link to="/guidelines" className="text-accent underline">
          community guidelines
        </Link>
        .
      </p>
      <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-4" noValidate>
        <FormError message={formError} />
        <Field
          id="username"
          label="Username"
          hint="Lowercase letters, numbers and underscores."
          error={errors.username}
        >
          <input
            id="username"
            name="username"
            autoComplete="username"
            maxLength={24}
            required
            aria-invalid={!!errors.username}
            aria-describedby={describedBy('username', true, errors.username)}
            className={inputClass}
          />
        </Field>
        <Field id="email" label="Email" error={errors.email}>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            aria-invalid={!!errors.email}
            aria-describedby={describedBy('email', false, errors.email)}
            className={inputClass}
          />
        </Field>
        <Field id="password" label="Password" hint="At least 8 characters." error={errors.password}>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            aria-invalid={!!errors.password}
            aria-describedby={describedBy('password', true, errors.password)}
            className={inputClass}
          />
        </Field>
        <button type="submit" disabled={busy} className={primaryButton}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="mt-6 text-sm text-muted">
        Already have an account?{' '}
        <Link to={`/login?next=${encodeURIComponent(next)}`} className="text-accent underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
