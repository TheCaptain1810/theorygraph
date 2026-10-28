# API Contract (Proposed)

Use REST JSON endpoints initially. Names are proposals; align with existing conventions if the repository already has them.

## Public
- `GET /api/health` — health check.
- `GET /api/films?query=&page=` — search films.
- `GET /api/films/:filmId` — film details.
- `GET /api/films/:filmId/interpretations?tag=&page=` — published interpretations.
- `GET /api/interpretations/:id` — interpretation, evidence, and counter-readings.
- `GET /api/users/:username` — public profile and contributions.

## Authenticated
- `POST /api/interpretations` — create interpretation.
- `PATCH /api/interpretations/:id` — edit own interpretation.
- `POST /api/interpretations/:id/evidence` — add evidence to an interpretation.
- `POST /api/interpretations/:id/counter-readings` — create counter-reading.
- `POST /api/counter-readings/:id/evidence` — add evidence to a counter-reading.
- `POST /api/reports` — report content.
- `DELETE /api/interpretations/:id` — soft-remove own content if supported by policy.

## API conventions
- Validate payloads using a schema library such as Zod.
- Return consistent errors: `{ "error": { "code": "...", "message": "..." } }`.
- Use correct HTTP status codes.
- Paginate list endpoints.
- Never trust client-provided author IDs; derive the current user from the verified session.
- Check ownership and moderation privileges on every write.
- Rate-limit create/report endpoints.
- Do not expose hidden or removed content through public endpoints.
- Keep provider API keys server-side.

## Implementation notes (starter)
- Spoiler gating: `GET /api/films/:filmId/interpretations` items and `GET /api/interpretations/:id` return `concealed: true` for `spoiler_level = major` with no title/claim/tags/evidence/counter-readings. Send `?reveal=true` to the detail endpoint to receive the full content (see `docs/engineering/DECISIONS.md` D006).
- Responses use camelCase field names (`spoilerLevel`, `interpretationType`, …).
- `POST /api/interpretations` body: `{ filmId, title, claim, interpretationType, spoilerLevel, evidence: [...], tags?: [...] }`. Evidence item: `{ evidenceType, description, sceneDescription?, timestampSeconds?, sourceUrl? }`.
- Authenticated requests send `Authorization: Bearer <Supabase access token>`.
- Page size is fixed at 20.
- `GET /api/me` (auth) returns `{ user: { id, username, role } }` from the database. The web app uses it to show moderator UI; the server re-checks the role on every request.
- `POST /api/reports` body: `{ targetType: 'interpretation' | 'counter_reading', targetId, reason, details? }`. Reasons: `abuse`, `plagiarism`, `spam`, `misinformation`, `copyright`, `spoiler`, `other`. Returns 201, or 200 with `alreadyReported: true` for a repeat by the same reporter. 404 for unknown/hidden/removed content; 400 `invalid_report` for your own content.
- Moderators and admins only (403 otherwise):
  - `GET /api/moderation/reports?status=open|dismissed|actioned&page=` lists reports oldest first with an excerpt of the target.
  - `POST /api/moderation/reports/:id/resolve` body `{ action: 'dismiss' | 'hide' | 'remove', note? }`. `hide`/`remove` change the content status (it leaves every public endpoint), settle all open reports on that content, and append a `moderation_actions` audit row. A report can be resolved once (404 afterwards).
  - `POST /api/moderation/content/:targetType/:targetId/restore` (`targetType` is `interpretation` or `counter_reading`; body `{ note? }`) republishes content a moderator hid or removed and appends a `restore` audit row. 409 `not_restorable` if the content is already published, or if its latest moderation decision was not hide/remove (so an author's own deletion cannot be undone). 404 if it does not exist.
- `GET /api/metadata/search?query=` (auth, rate limited; 2-100 characters) searches TMDB and returns `{ items: [{ tmdbId, title, releaseYear, posterPath, filmId }], attribution }`. `filmId` is our id when the film is already in the catalogue, otherwise null. At most 10 results. 502 `metadata_unavailable` if TMDB fails or our key is rejected; 503 if `TMDB_API_KEY` is not configured.
- `POST /api/metadata/import` body `{ tmdbId }` (auth, rate limited) adds a film to the catalogue and returns `{ film, created }` (201 on create, 200 if it already existed). The server re-fetches title, year, director and poster from TMDB; the client cannot supply them. Poster paths are validated before storage. 404 if TMDB has no such film.
- `DELETE /api/counter-readings/:id` soft-removes a counter-reading. Allowed for its author and for moderators/admins (403 otherwise; 404 if unknown or already removed). The interpretation's author cannot remove other people's counter-readings; they can report them.
- `GET /api/users/:username?page=` (public) returns `{ user: { username, displayName, bio, joinedAt }, interpretations: Page, counterReadings: { total, items } }`. Published content only. Major-spoiler interpretations come back `concealed` with no text; a counter-reading is concealed when its parent interpretation is major-spoiler (the parent's level decides). Counter-readings are the latest 20 with a 280-character excerpt. Email and role are never returned. 404 for unknown users, 400 for malformed usernames.
- Not implemented yet: replies, reporting evidence/replies/users, warn/suspend.
