import { createContext, useContext } from 'react';

export interface AuthUser {
  id: string;
  email: string | null;
  username: string | null;
  /** From the server (database), not the token. Null until /api/me has answered. */
  role: 'user' | 'moderator' | 'admin' | null;
}

export interface AuthState {
  /** 'loading' until the stored session has been read. */
  status: 'loading' | 'signedOut' | 'signedIn';
  user: AuthUser | null;
  configured: boolean;
  signOut: () => Promise<void>;
}

/** Default (no provider) is signed out, so components render safely in tests and isolation. */
const signedOut: AuthState = {
  status: 'signedOut',
  user: null,
  configured: false,
  signOut: async () => {},
};

export const AuthContext = createContext<AuthState>(signedOut);

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
