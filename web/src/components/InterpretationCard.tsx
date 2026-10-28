import { Link } from 'react-router';
import type { InterpretationSummary } from '../api/types';
import { SpoilerBadge, TypeBadge } from './Badges';
import { plural } from './labels';

export function InterpretationCard({
  item,
  filmTitle,
}: {
  item: InterpretationSummary;
  /** Shown on profile pages, where cards from different films are mixed. */
  filmTitle?: string;
}) {
  const counts = `${plural(item.evidenceCount, 'piece')} of evidence · ${plural(item.counterReadingCount, 'counter-reading')}`;

  if (item.concealed) {
    return (
      <li className="rounded border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center gap-2">
          <TypeBadge type={item.interpretationType} />
          <SpoilerBadge level={item.spoilerLevel} />
        </div>
        {filmTitle && <p className="mt-3 text-sm text-muted">On {filmTitle}</p>}
        <p className="mt-3 font-serif text-lg">Concealed: contains major spoilers</p>
        <p className="mt-1 text-sm text-muted">{counts}</p>
        <Link
          to={`/interpretations/${item.id}`}
          className="mt-3 inline-block text-sm text-accent underline"
        >
          Open this interpretation (you will be asked before anything is revealed)
        </Link>
      </li>
    );
  }

  return (
    <li className="rounded border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <TypeBadge type={item.interpretationType} />
        <SpoilerBadge level={item.spoilerLevel} />
      </div>
      <h3 className="mt-3 font-serif text-xl">
        <Link to={`/interpretations/${item.id}`} className="hover:text-accent">
          {item.title}
        </Link>
      </h3>
      <p className="mt-1 line-clamp-3 text-muted">{item.claim}</p>
      <p className="mt-3 text-sm text-muted">
        by{' '}
        <Link to={`/profile/${item.author.username}`} className="underline">
          {item.author.displayName ?? item.author.username}
        </Link>{' '}
        · {counts}
        {filmTitle ? ` · on ${filmTitle}` : ''}
      </p>
      {item.tags.length > 0 && (
        <p className="mt-2 text-sm text-muted">Tags: {item.tags.join(', ')}</p>
      )}
    </li>
  );
}
