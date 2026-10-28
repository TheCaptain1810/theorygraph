# Design System and UX Principles

## Product feel
Thoughtful, editorial, cinematic, and intellectually welcoming. It should feel like a well-organised film journal or research notebook—not a generic social feed, streaming service, or AI chatbot.

## Design principles
1. **The interpretation is the hero.** Keep the claim and its evidence more prominent than popularity metrics.
2. **Evidence is visible.** Scene references and observations should be easy to inspect.
3. **Disagreement is constructive.** Counter-readings are first-class content, not hidden under a hostile comment thread.
4. **Subjectivity is respected.** Do not label interpretations “correct” based on votes.
5. **Spoilers are deliberate.** Clearly label and gate spoiler-heavy content.
6. **Attribution matters.** Every contribution has a clear author and timestamp.
7. **Readable first.** Prioritise typography, line length, spacing, keyboard accessibility, and mobile responsiveness.
8. **No fake film UI.** Do not use unlicensed movie stills as decoration. Use permitted posters, text, gradients, or placeholders.

## Visual direction
- Dark charcoal or warm near-black surfaces, with a restrained warm accent.
- Strong readable type hierarchy; editorial serif may be used for film titles or long-form claims, paired with a clean sans-serif for UI.
- Avoid excessive neon, glassmorphism, gradients, or cards nested inside cards.
- Use borders and spacing to distinguish claim, evidence, and counter-reading.
- Maintain good contrast in both light and dark modes if both are implemented.
- Keep animation subtle and respect reduced-motion preferences.

## Main routes
- `/` — landing page with product explanation and selected discussions.
- `/films` — film catalogue and search.
- `/films/:filmId` — film detail page and interpretation list.
- `/interpretations/:interpretationId` — interpretation, evidence, counter-readings, and replies.
- `/new/interpretation?filmId=:filmId` — create interpretation.
- `/login` and `/signup` — authentication.
- `/profile/:username` — public contribution history.
- `/guidelines` — community and content rules.

## Film page hierarchy
1. Film title, year, director, metadata source attribution.
2. Spoiler warning where relevant.
3. Short introduction and browse controls.
4. Interpretations ordered by useful defaults, not simply votes.
5. Filters for motif/technique/type.
6. Clear call to contribute.

## Interpretation page hierarchy
1. Title and claim.
2. Claim classification and spoiler label.
3. Scene references and observations.
4. External sources, if any.
5. Counter-readings.
6. Replies and constructive discussion.
7. Report and edit controls.

## Interpretation creation form
Required:
- Title.
- Main claim.
- Interpretation type.
- At least one observation or scene reference.
- Spoiler level.

Optional:
- Additional observations.
- External sources.
- Motif/technique tags.

Explain that an observation is what the viewer can point to, while an interpretation is what they think it means.

## Empty states
Avoid empty, sterile pages. Explain what belongs here and offer one clear next step. Do not fabricate community activity or imply users exist when they do not.

## Accessibility
- Semantic headings and buttons.
- Keyboard navigation and visible focus.
- Labels and useful validation messages.
- Do not communicate spoiler status by colour alone.
- Screen-reader accessible disclosure controls.
- Respect reduced motion.
