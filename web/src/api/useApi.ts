import { useEffect, useState } from 'react';
import { apiGet, apiGetAuthed, ApiClientError } from './client';

export type ApiState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string; notFound: boolean; reload: () => void }
  | { status: 'success'; data: T; reload: () => void };

type Result<T> = { key: string; ok: true; data: T } | { key: string; ok: false; error: unknown };

/**
 * Fetches `path` and exposes loading / error / success. Pass `{ auth: true }` for endpoints that need the
 * signed-in user's token (public endpoints must not send it). The result is tagged with the request key
 * so a stale response is never shown for a new path, without calling setState synchronously in an effect.
 */
export function useApi<T>(path: string, opts: { auth?: boolean } = {}): ApiState<T> {
  const auth = opts.auth === true;
  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState<Result<T> | null>(null);
  const key = `${path}#${nonce}`;

  useEffect(() => {
    const ctrl = new AbortController();
    (auth ? apiGetAuthed<T> : apiGet<T>)(path, ctrl.signal)
      .then((data) => setResult({ key, ok: true, data }))
      .catch((error: unknown) => {
        if (ctrl.signal.aborted) return;
        setResult({ key, ok: false, error });
      });
    return () => ctrl.abort();
  }, [path, key, auth]);

  if (!result || result.key !== key) return { status: 'loading' };
  const reload = () => setNonce((n) => n + 1);
  if (result.ok) return { status: 'success', data: result.data, reload };
  const err = result.error;
  return {
    status: 'error',
    message: err instanceof ApiClientError ? err.message : 'Something went wrong.',
    notFound: err instanceof ApiClientError && err.status === 404,
    reload,
  };
}
