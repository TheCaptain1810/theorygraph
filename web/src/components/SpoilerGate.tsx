import type { SpoilerLevel } from '../api/types';
import { SpoilerBadge } from './Badges';

/** Nothing spoiler-bearing is in the DOM until the reader presses the button (the server withholds it). */
export function SpoilerGate({
  level,
  onReveal,
  loading,
}: {
  level: SpoilerLevel;
  onReveal: () => void;
  loading: boolean;
}) {
  return (
    <div
      role="region"
      aria-labelledby="spoiler-gate-title"
      className="rounded border border-accent/60 p-6"
    >
      <SpoilerBadge level={level} />
      <h2 id="spoiler-gate-title" className="mt-3 font-serif text-2xl">
        This interpretation contains major spoilers
      </h2>
      <p className="mt-2 text-muted">
        The title, claim, evidence and counter-readings are hidden. Only reveal them if you have
        seen the film or do not mind being spoiled.
      </p>
      <button
        type="button"
        onClick={onReveal}
        disabled={loading}
        className="mt-4 rounded bg-accent px-4 py-2 font-medium text-bg hover:opacity-90 disabled:opacity-60"
      >
        {loading ? 'Revealing…' : 'Reveal major spoilers'}
      </button>
    </div>
  );
}
