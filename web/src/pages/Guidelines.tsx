import { usePageTitle } from '../usePageTitle';

// Summarises docs/product/COMMUNITY_RULES.md. Keep the two in sync.
export function Guidelines() {
  usePageTitle('Guidelines');
  return (
    <div className="max-w-prose">
      <h1 className="font-serif text-3xl">Community guidelines</h1>
      <p className="mt-3 text-muted">
        TheoryGraph aims to make nuanced film analysis welcoming, evidence-aware and safe for people
        who have not seen every film.
      </p>

      <h2 className="mt-8 font-serif text-2xl">What you can contribute</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5">
        <li>
          <strong>Observation:</strong> a describable detail in a scene.
        </li>
        <li>
          <strong>Interpretation:</strong> a proposed meaning of one or more observations.
        </li>
        <li>
          <strong>Fan theory:</strong> a more speculative explanation, labelled honestly.
        </li>
        <li>
          <strong>Production fact:</strong> a claim about intent, production or history. Cite a
          credible source where you can.
        </li>
        <li>
          <strong>Counter-reading:</strong> a different interpretation of the same material.
        </li>
        <li>
          <strong>Question:</strong> a sincere request for clarification or other perspectives.
        </li>
      </ul>
      <p className="mt-3 text-muted">
        These are not a hierarchy of worth. Speculative readings are welcome when labelled honestly.
      </p>

      <h2 className="mt-8 font-serif text-2xl">Discussion norms</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5">
        <li>Critique claims, not people.</li>
        <li>Explain why you disagree, and cite a scene, observation or source when possible.</li>
        <li>Do not present popularity as proof.</li>
        <li>Do not claim to know a filmmaker’s private intent without credible evidence.</li>
        <li>Distinguish “the film shows” from “I interpret this as”.</li>
        <li>Credit sources and other contributors. No plagiarism.</li>
        <li>No harassment, threats, hate, spam or targeted abuse.</li>
      </ul>

      <h2 className="mt-8 font-serif text-2xl">Spoilers</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5">
        <li>Every contribution declares a spoiler level.</li>
        <li>Major spoilers stay hidden until a reader deliberately reveals them.</li>
        <li>Do not put spoilers in titles.</li>
      </ul>

      <h2 className="mt-8 font-serif text-2xl">Reporting</h2>
      <p className="mt-3">
        Reporting and moderation tools are planned for the pilot beta. Do not upload or link to
        pirated footage.
      </p>
    </div>
  );
}
