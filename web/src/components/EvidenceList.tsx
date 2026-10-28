import type { Evidence } from '../api/types';
import { evidenceLabel, formatTimestamp } from './labels';

/** Only http(s) links are ever rendered as anchors; anything else is shown as plain text. */
export function safeHref(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

export function EvidenceList({ evidence, heading }: { evidence: Evidence[]; heading: string }) {
  if (evidence.length === 0) {
    return <p className="text-sm text-muted">No evidence attached.</p>;
  }
  return (
    <section aria-label={heading}>
      <ul className="space-y-3">
        {evidence.map((e) => {
          const href = safeHref(e.sourceUrl);
          return (
            <li key={e.id} className="border-l-2 border-accent/60 pl-4">
              <p className="text-xs uppercase tracking-wide text-muted">
                {evidenceLabel[e.evidenceType]}
                {e.timestampSeconds !== null && <> · at {formatTimestamp(e.timestampSeconds)}</>}
              </p>
              {e.sceneDescription && <p className="mt-1 font-medium">{e.sceneDescription}</p>}
              <p className="mt-1">{e.description}</p>
              {e.sourceUrl && (
                <p className="mt-1 text-sm">
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="text-accent underline"
                    >
                      Source: {new URL(href).hostname}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  ) : (
                    <span className="text-muted">Source: {e.sourceUrl}</span>
                  )}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
