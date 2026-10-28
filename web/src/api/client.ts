import { supabase } from '../auth/supabase';

const BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000').replace(/\/+$/, '');

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    /** Zod issues from the server for 400 responses, when present. */
    public readonly details: FieldIssue[] = [],
  ) {
    super(message);
  }
}

export interface FieldIssue {
  path: string;
  message: string;
}

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  opts: { body?: unknown; signal?: AbortSignal; auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.auth) {
    const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
    if (!data.session) throw new ApiClientError(401, 'unauthenticated', 'Sign in to continue');
    headers.Authorization = `Bearer ${data.session.access_token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      signal: opts.signal,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new ApiClientError(
      0,
      'network_error',
      'Could not reach the server. Check your connection.',
    );
  }
  if (!res.ok) {
    let code = 'http_error';
    let message = `Request failed (${res.status})`;
    let details: FieldIssue[] = [];
    try {
      const body = (await res.json()) as {
        error?: { code?: string; message?: string; details?: unknown };
      };
      if (body.error?.code) code = body.error.code;
      if (body.error?.message) message = body.error.message;
      if (Array.isArray(body.error?.details)) details = body.error.details as FieldIssue[];
    } catch {
      /* non-JSON error body */
    }
    throw new ApiClientError(res.status, code, message, details);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** GET JSON from the API. Public: no token is sent. */
export function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  return request<T>('GET', path, { signal });
}

/** Authenticated read (moderation queue, current user). */
export function apiGetAuthed<T>(path: string, signal?: AbortSignal): Promise<T> {
  return request<T>('GET', path, { signal, auth: true });
}

/** Authenticated write. Throws a 401 ApiClientError without calling the API when signed out. */
export function apiSend<T>(
  method: 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  return request<T>(method, path, { body, auth: true });
}
