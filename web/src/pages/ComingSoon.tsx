import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { EmptyState } from '../components/StateViews';
import { usePageTitle } from '../usePageTitle';

/** Honest placeholder for routes defined in docs/design/DESIGN.md whose UI is not built yet. */
export function ComingSoon({ title, children }: { title: string; children: ReactNode }) {
  usePageTitle(title);
  return (
    <EmptyState
      title={title}
      action={
        <Link to="/films" className="text-accent underline">
          Browse films
        </Link>
      }
    >
      {children}
    </EmptyState>
  );
}

export function NotFoundPage() {
  usePageTitle('Page not found');
  return (
    <EmptyState
      title="Page not found"
      action={
        <Link to="/" className="text-accent underline">
          Go home
        </Link>
      }
    >
      <p>That page does not exist.</p>
    </EmptyState>
  );
}
