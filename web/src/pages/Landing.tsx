import { Link } from 'react-router';
import { usePageTitle } from '../usePageTitle';

export function Landing() {
  usePageTitle('');
  return (
    <div>
      <h1 className="font-serif text-4xl leading-tight sm:text-5xl">
        Connect a reading of a film to the scenes that inspired it.
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-muted">
        TheoryGraph is a place to write down an interpretation, point to the moments that support
        it, and set it beside competing readings, without pretending any reading is the objectively
        correct one.
      </p>
      <p className="mt-6">
        <Link
          to="/films"
          className="rounded bg-accent px-4 py-2 font-medium text-bg hover:opacity-90"
        >
          Browse films
        </Link>
      </p>

      <section aria-labelledby="how" className="mt-14">
        <h2 id="how" className="font-serif text-2xl">
          How it works
        </h2>
        <ol className="mt-4 space-y-4">
          <li className="border-l-2 border-accent/60 pl-4">
            <strong>Observation:</strong> what you can point to in a scene.
          </li>
          <li className="border-l-2 border-accent/60 pl-4">
            <strong>Interpretation:</strong> what you think it means. Label it honestly as an
            interpretation, a fan theory, a production fact or a question.
          </li>
          <li className="border-l-2 border-accent/60 pl-4">
            <strong>Counter-reading:</strong> a different reading of the same material, with its own
            evidence, shown right beside the original.
          </li>
        </ol>
      </section>

      <section aria-labelledby="spoilers" className="mt-12">
        <h2 id="spoilers" className="font-serif text-2xl">
          Spoilers are deliberate
        </h2>
        <p className="mt-2 max-w-2xl text-muted">
          Contributions declare a spoiler level. Major spoilers stay hidden until you choose to
          reveal them.
        </p>
      </section>
    </div>
  );
}
