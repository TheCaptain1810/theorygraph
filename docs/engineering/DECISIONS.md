# Decision Log

Record material product and engineering decisions here.

## Initial decisions

### D001 — Focus on structured interpretation, not ratings
**Decision:** The core object is an interpretation linked to evidence, with counter-readings.

**Reason:** This is the strongest product hypothesis aligned with film theories, symbolism, directors, and cinematography.

**Trade-off:** More friction than a basic comment form. The UI must make the structure feel worthwhile rather than academic.

### D002 — Relational database first
**Decision:** Use PostgreSQL and relational links; no graph database for MVP.

**Reason:** The initial relationships are well represented with foreign keys and join tables.

### D003 — No required AI
**Decision:** The product works without AI in its first release.

**Reason:** Validate the human contribution loop before adding cost, factuality risks, and complexity.

### D004 — No film footage hosting
**Decision:** Use timestamps, descriptions, and permitted source links rather than redistributing films.

**Reason:** Reduce copyright and storage risks.

## Add future decisions
For each decision record:
- Context/problem.
- Options considered.
- Decision.
- Consequences/trade-offs.
- Date and owner.

## Starter implementation decisions

### D005 — Stack follows `docs/engineering/ARCHITECTURE.md` defaults
**Decision:** React + Vite + Tailwind, Express + TypeScript, PostgreSQL + Prisma, Zod, Vitest/Supertest, npm workspaces (`web/`, `server/`), Supabase Auth for identity.
**Reason:** No existing repository to inherit from; these are the documented defaults.
**Consequences:** Playwright is not installed yet (no e2e tests until the authoring UI exists). Package versions are the latest at generation time (Prisma 7, Zod 4, Express 5, React Router 8, Vite 8); TypeScript is pinned to 5.9 because `typescript-eslint` does not yet support newer majors.

### D006 — Server-side spoiler gating
**Decision:** Major-spoiler interpretations are concealed in the API itself: list items omit title/claim/tags, and the detail endpoint omits all text unless `?reveal=true` is sent. The web app sends that only after the reader presses a button.
**Reason:** `docs/product/MVP.md` requires concealment in previews and deliberate reveal; hiding text only in CSS would leak it to anyone reading the response or page source.
**Trade-offs:** A reveal is a second request. `reveal=true` is not an authorization boundary, only a deliberate-action signal. Page titles never contain interpretation text.

### D007 — Roles stored in the database
**Decision:** `users.role` (`user`, `moderator`, `admin`) is read from the database on every authenticated request, never from the token or request. Moderators may remove content; only authors may edit.
**Reason:** `docs/product/MVP.md` calls for explicit elevated moderator permissions and own-content-only editing.

### D008 — Profile auto-provisioning
**Decision:** The first authenticated request creates a `users` row keyed by the auth provider's user ID, with a username derived from `user_metadata.username` or the email local part (sanitised, de-duplicated).
**Reason:** Avoids an extra onboarding endpoint for the first slice.
**Trade-off:** Users cannot pick or change usernames yet.

### D009 — Evidence rules
**Decision:** A new interpretation must include at least one evidence item that is an observation or carries a scene description/timestamp. External-source evidence requires an http(s) link (no credentials). Only the interpretation's author can add evidence to it; others add a counter-reading with its own evidence.
**Reason:** `docs/product/MVP.md` evidence and counter-reading acceptance criteria.

### D010 — Hand-written initial migration
**Decision:** The first migration SQL was written by hand (Prisma cannot express CHECK constraints) and verified by applying it to PostgreSQL 16 and running DB-backed tests. `prisma migrate dev` could not be run where the starter was generated.
**Action:** Run `npm run db:migrate -w server` once locally and confirm no drift is reported.
**Outcome (2026-10-27):** Drift was found. The hand-written SQL used `ON DELETE RESTRICT` for the two `evidence` foreign keys, while Prisma's default for an optional relation is `SET NULL` (which would also collide with the exactly-one-parent CHECK). Resolved by pinning `onDelete: Restrict` in `schema.prisma`; migration `restore_evidence_fk_restrict` returns the database to RESTRICT. `prisma migrate diff` now reports no drift.

### D011 — Web auth with Supabase and a server-provided profile
**Decision:** The web app signs in/up with `@supabase/supabase-js` (email + password, username in `user_metadata`), sends the access token as a bearer token on writes only, and reads username and role from `GET /api/me`. Public GETs never send a token. Email confirmation stays on in Supabase; the sign-up page tells the user to check their email.
**Reason:** Keeps D007 intact (role is never taken from the token) and keeps public pages cacheable and token-free.
**Trade-offs:** The server calls Supabase on every authenticated request; local JWKS verification is a later optimisation. Route guards in the web app are convenience only; the API enforces auth.

### D012 — Reports and moderation scope
**Decision:** Users may report an interpretation or counter-reading (one report per reporter per target; repeats are idempotent; not your own content; hidden/removed content returns 404 so its existence is not confirmed). Moderators/admins work an oldest-first queue and choose dismiss, hide or remove, with an optional note. Hide/remove settle every open report on the same content in one transaction and append a `moderation_actions` row.
**Out of scope for now:** reporting evidence/replies/users, warn/suspend, notifications to reporters or authors.
**Reason:** `docs/product/MVP.md` asks for basic reporting and moderation with an audit trail "as scope permits".

### D013 — Restoring moderated content
**Decision:** Moderators/admins can republish content that a moderator hid or removed (`POST /api/moderation/content/:targetType/:targetId/restore`), recorded as a `restore` row in `moderation_actions`. Restore is allowed only when the content is not published and its latest moderation decision was hide or remove. The UI lists handled reports on the `/moderation` "Handled" tab.
**Reason:** Moderation mistakes and successful appeals need an in-product undo with an audit trail, but a moderator must not be able to resurrect something an author deleted themselves.
**Trade-offs:** Authors are not notified; there is no appeal workflow. Restoring content does not reopen the original reports.

### D014 — Film metadata from TMDB, imported on demand
**Decision:** Signed-in users can search TMDB through our API and add a film to the catalogue (`/api/metadata/search`, `/api/metadata/import`). The server calls TMDB with the key, re-fetches the metadata itself on import, validates the response and poster path, and stores title, year, director and the poster path (not the image). Posters are loaded by the browser from TMDB's image CDN. Each imported film stores the attribution `TMDB (The Movie Database)`, and the site footer carries TMDB's required notice.
**Reason:** A hand-seeded catalogue cannot cover what people want to discuss; importing on demand keeps the catalogue to films that have conversations.
**Trade-offs and open items:** Any signed-in user can grow the catalogue (rate limited, no approval step). The free TMDB API is for non-commercial use, and their terms ask for their logo in the attribution and limit how long data may be cached; review the current terms before any public or commercial launch (see `docs/engineering/ENVIRONMENT.md`). Imported rows are never refreshed from TMDB, so corrections upstream do not propagate. Search of interpretations (full text) is still not built.

### D015 — End-to-end tests with a real Supabase test account
**Decision:** Playwright drives a real browser against the real API and real Supabase Auth, using one dedicated, already-confirmed test account (credentials in the gitignored `e2e/.env`) and an isolated `theorygraph_e2e` database that is emptied and reseeded on every run. There is no test-only authentication bypass in the server. The few things the product deliberately has no UI for (granting the moderator role) are done by a direct database update in the test.
**Reason:** A bypass would be a path around authentication that exists in production code; testing the real login also checks the thing most likely to break in deployment.
**Trade-offs:** The tests depend on Supabase being reachable and on one shared account, so they run serially in one worker. Logging out revokes the session it runs in, so the sign-out test logs in with its own session. They are not in CI yet: that needs the Supabase and e2e credentials as CI secrets and a decision about which Supabase project CI may use.
**What it found:** the moderation queue never sent the login token (unit tests had mocked `fetch` and only checked the token on writes), a film page with existing interpretations had no link to write another, and sign-out ended the user's sessions on every device (now this browser only).

### D016 — Development database moves to Supabase Postgres, with RLS deny-by-default
**Decision:** Development now uses the Supabase project's PostgreSQL through the Session pooler (migrations and runtime on port 5432). Automated tests (unit/integration and e2e) stay on local Docker databases. Migration `enable_rls` turns on Row Level Security, with no policies, on every table including `_prisma_migrations`.
**Reason:** Supabase exposes every `public` table through its REST API to holders of the publishable key, which is public by design. The app never uses that API, so the tables should be unreachable through it. Verified after the move: the REST API returns `[]` for tables that contain rows, while the server (the table owner, exempt from RLS) reads them normally.
**Trade-offs:** The Session pooler is IPv4-compatible but is a shared pooler, so connection counts are limited; revisit when deploying. Production should be a separate Supabase project. Data created in the old local database before the move does not carry over automatically.
