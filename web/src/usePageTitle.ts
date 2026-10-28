import { useEffect } from 'react';

/** Page titles never include interpretation text (it may be a spoiler). */
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · TheoryGraph` : 'TheoryGraph';
  }, [title]);
}
