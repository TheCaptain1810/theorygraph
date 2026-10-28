import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { apiGetAuthed } from '../api/client';
import { AuthContext, type AuthState, type AuthUser } from './AuthContext';
import { authConfigured, supabase } from './supabase';

interface Profile {
  id: string;
  username: string;
  role: NonNullable<AuthUser['role']>;
}

function toUser(session: Session | null, profile: Profile | null): AuthUser | null {
  if (!session) return null;
  const meta = session.user.user_metadata as { username?: unknown } | undefined;
  return {
    id: session.user.id,
    email: session.user.email ?? null,
    username: profile?.username ?? (typeof meta?.username === 'string' ? meta.username : null),
    role: profile?.role ?? null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // With no Supabase config there is nothing to load: start (and stay) signed out.
  const [session, setSession] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState(!authConfigured);
  const [profile, setProfile] = useState<Profile | null>(null);
  const userId = session?.user.id ?? null;

  // Ask the server who we are (username + role live in the database). Failure leaves role unknown.
  useEffect(() => {
    if (!userId) return;
    const ctrl = new AbortController();
    apiGetAuthed<{ user: Profile }>('/api/me', ctrl.signal)
      .then((r) => setProfile(r.user))
      .catch(() => {
        /* signed in but profile unavailable: moderator UI simply stays hidden */
      });
    return () => ctrl.abort();
  }, [userId]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoaded(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoaded(true);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthState>(() => {
    const user = toUser(session, profile?.id === userId ? profile : null);
    return {
      status: !loaded ? 'loading' : user ? 'signedIn' : 'signedOut',
      user,
      configured: authConfigured,
      signOut: async () => {
        // Ends this browser's session only; the default ("global") would also log the user out on every other device.
        await supabase?.auth.signOut({ scope: 'local' });
      },
    };
  }, [session, loaded, profile, userId]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
