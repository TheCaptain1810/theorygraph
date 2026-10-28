# MVP Definition and Acceptance Criteria

## Must ship
1. Film search and basic film pages.
2. Public interpretation pages.
3. Authenticated interpretation creation/editing.
4. Evidence and scene-reference creation.
5. Counter-readings with their own evidence.
6. Spoiler labels and deliberate reveal UI.
7. Tags and basic search/filtering.
8. Shareable URLs.
9. Basic reporting and moderation.
10. Responsive, accessible interface.

## Acceptance criteria

### Create interpretation
- An authenticated user can submit a valid title and claim.
- At least one observation or scene reference is required.
- Invalid input returns useful validation feedback.
- Server verifies the user identity and validates all input.
- The created page has a stable URL.

### Evidence
- Evidence clearly identifies whether it is an observation or external source.
- Timestamps cannot be negative.
- Links are validated and safely rendered.
- Evidence belongs to exactly one interpretation or counter-reading.

### Counter-reading
- A signed-in user can add an alternative reading to a published interpretation.
- The original interpretation remains visible.
- Each counter-reading can have independent evidence.
- Votes, if added, never label an interpretation objectively true.

### Spoilers
- Major spoilers are concealed in list previews and open only after deliberate action.
- Search snippets and notifications do not leak concealed spoilers.
- The user can identify spoiler status without relying on colour alone.

### Permissions
- Users can edit their own content only.
- Moderators have explicit elevated permissions.
- Hidden/removed content is not available through public API responses.
- Rate limits and validation are applied server-side.

### Quality
- Loading, empty, error, and success states exist.
- Core flows work on mobile and desktop.
- Keyboard navigation and focus states are usable.
- Automated tests cover authorization, evidence-parent constraints, and spoiler gating.
