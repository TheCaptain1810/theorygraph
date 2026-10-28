import type { ReactNode } from 'react';

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <p role="status" aria-live="polite" className="py-10 text-muted">
      {label}
    </p>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="my-6 rounded border border-danger/50 p-4">
      <p className="font-medium text-danger">Something went wrong</p>
      <p className="mt-1 text-sm text-muted">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded border border-border px-3 py-1.5 text-sm hover:border-accent"
        >
          Try again
        </button>
      )}
    </div>
  );
}

/** Explains what belongs here and offers one next step. Never implies activity that does not exist. */
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="my-6 rounded border border-dashed border-border p-6">
      <h2 className="font-serif text-xl">{title}</h2>
      <div className="mt-2 text-muted">{children}</div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
