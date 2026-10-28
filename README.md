# TheoryGraph — Project Starter Pack

TheoryGraph is a community product for cinephiles to create, explore, and challenge evidence-linked interpretations of films.

## Product hypothesis
Film enthusiasts want a structured place to connect interpretations to specific scenes, support them with observations, and compare alternative readings—without treating subjective interpretations as objective truth.

This is a hypothesis to validate, not a proven market gap.

## Start here
1. Read `docs/product/PRODUCT.md` and `docs/product/MVP.md`.
2. Read `docs/design/DESIGN.md` before building UI.
3. Read `docs/engineering/ARCHITECTURE.md` and `docs/engineering/DATA_MODEL.md` before implementation.
4. Follow `docs/ai/AI_RULES.md` for any AI-assisted features.
5. Use `docs/product/ROADMAP.md` to plan implementation.
6. Use `CLAUDE.md` as the working agreement for Claude Code.

## Suggested first milestone
A deployed beta where a user can:
- Browse/search a small curated catalogue of films.
- Open a film page and read interpretations.
- Publish an interpretation with scene references and observations.
- Add a counter-reading with its own evidence.
- Share public URLs and respect spoiler controls.

## Important boundaries
- Do not claim the concept is unique or that market demand is proven.
- Do not host or redistribute movie footage.
- Check licensing and attribution terms for every external data source.
- Do not build AI theory generation, video analysis, recommendation algorithms, or native apps in the MVP.

---

# Repository guide (starter code)

This repository contains the documentation above **and** a working starter implementation of the first vertical slice. Read `CLAUDE.md` before using Claude Code here.

## Layout
```
server/   Express + TypeScript API, Prisma schema + SQL migration, seed, tests
web/      React + TypeScript + Vite + Tailwind + React Router, tests
e2e/      Playwright end-to-end tests
docs/     Project documentation (source of truth for scope and rules), see docs/README.md
CLAUDE.md Working agreement for Claude Code
```

## Quick start
Requires Node 22+ and a PostgreSQL database: your Supabase project's (recommended for development, see below) or a local one (`docker compose up -d` starts PostgreSQL 16).

```bash
npm install                      # also runs `prisma generate` for the server
cp server/.env.example server/.env
cp web/.env.example web/.env
docker compose up -d             # only if you use the local database; for Supabase set DATABASE_URL instead
npm run db:deploy -w server      # apply migrations (use `npm run db:migrate` while developing schema changes)
npm run db:seed                  # 3 films + 2 clearly labelled [SAMPLE] interpretations
npm run dev:server               # http://localhost:4000/api/health
npm run dev:web                  # http://localhost:5173
```

## Checks
```bash
npm run lint && npm run typecheck && npm test && npm run build
# optional DB-backed tests (needs a migrated database; use a separate one):
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/theorygraph_test npm test -w server
```

## What is implemented
| Area | Status |
| --- | --- |
| `GET /api/health`, films list/detail, interpretations per film (tag filter, pagination) | Done |
| `GET /api/interpretations/:id` with server-side spoiler gating (`?reveal=true`) | Done |
| `POST/PATCH/DELETE /api/interpretations`, evidence, counter-readings (+ their evidence) | Done, with Zod validation, ownership checks, rate limits |
| DB constraints: evidence has exactly one parent, non-negative timestamps | Done (migration CHECKs) |
| Bearer-token verification against Supabase Auth, profile auto-provisioning, `GET /api/me` | Done. Supabase accepts the project key and rejects bad tokens; a **full sign-in → write round trip with a real account has not been run yet** |
| Web: landing, films, film page, interpretation page with spoiler gate, guidelines | Done (loading/empty/error states) |
| Web: sign-up (email confirmation), log in/out, route guard | Done (unit-tested with a mocked Supabase session) |
| Web: interpretation authoring form, evidence editor, counter-reading form | Done (client checks mirror server rules; server errors shown per field) |
| `POST /api/reports`, moderator queue + dismiss/hide/remove, audit trail; web report button and `/moderation` | Done |
| `GET /api/users/:username` and `/profile/:username` (spoiler-gated contribution history; authors link to it) | Done |
| Edit an interpretation (title, claim, type, spoiler level), add evidence to it, delete it, delete your own counter-reading (two-step confirm; server enforces ownership) | Done |
| Moderators restore hidden/removed content (`/moderation` → Handled tab), audited | Done |
| Replies, editing a counter-reading's text | **Not built** |
| TMDB film search and import (signed-in users add films; posters and attribution shown) | Done; live-checked against TMDB |
| Playwright end-to-end tests: real browser, real API, real Supabase login, isolated database (`npm run e2e`) | Done: 14 tests |
| Full-text search of interpretations (with spoiler-safe snippets) | **Not built** |

## Suggested next slices (in `docs/product/ROADMAP.md` order)
1. Run the manual sign-in checklist below with a real account.
2. Deployment, then full-text search of interpretations.

## Which database?
- **Development** (`server/.env` `DATABASE_URL`): your Supabase project, using the **Session pooler** connection string (Connect → ORM). The direct host is IPv6-only and fails on many networks. Run `npm run db:deploy -w server` then `npm run db:seed` once. Tables appear under Table Editor in the Supabase dashboard.
- **Automated tests**: always local Docker. `TEST_DATABASE_URL` (`theorygraph_test`) and `E2E_DATABASE_URL` (`theorygraph_e2e`) must never point at Supabase: the e2e run empties its database every time.
- Restart `npm run dev:server` after changing `.env`; the file watcher does not reload it.

## End-to-end tests (Playwright)
`npm run e2e` starts its own API (port 4100) and web app (port 5273), so it never touches your dev servers. It logs in through the real UI with a real Supabase test account, and uses its own database, `theorygraph_e2e`, which it **empties and reseeds on every run** (it refuses any database whose name does not end in `_e2e`).

One-time setup:
1. `docker compose exec db psql -U postgres -c "CREATE DATABASE theorygraph_e2e"`
2. `npx playwright install chromium`
3. Create a throwaway account in your Supabase project (confirm its email), then copy `e2e/.env.example` to `e2e/.env` and fill in `E2E_USERNAME`, `E2E_EMAIL`, `E2E_PASSWORD`. Use a password you do not use anywhere else. The file is gitignored.

What it covers: signed-out browsing, spoiler gating (nothing in the page or API until revealed), login redirects and wrong-password handling, keyboard skip link, no horizontal scroll at phone width, and signed in: validation, publish, counter-reading, edit, delete, profile, sign-out, report, moderation hide, and restore. `npm run e2e:ui` opens the interactive runner. The tests need `server/.env` and `web/.env` to hold your Supabase settings, so they are not part of CI yet (see `docs/engineering/DECISIONS.md` D015).

## Manual sign-in check (needs your Supabase project)
1. `docker compose up -d`, `npm run db:deploy -w server`, `npm run db:seed`, then `npm run dev:server` and `npm run dev:web`.
2. Sign up at `/signup` and confirm the email (email confirmation is on in Supabase). Log in.
3. Open a film, write an interpretation, then open it and add a counter-reading.
4. Make yourself a moderator, then reload: `UPDATE users SET role = 'moderator' WHERE username = '<you>';` (for example `docker compose exec db psql -U postgres theorygraph`). Sign in as a second user, report something, and work the queue at `/moderation`.

## Known gaps and risks
- Supabase token verification calls `GET {SUPABASE_URL}/auth/v1/user` on every authenticated request. It works with the publishable key; moving to local JWKS verification would remove the extra network call.
- Row Level Security is enabled with no policies on every table (migration `enable_rls`), so the Supabase REST API returns nothing for them even with the publishable key. The server connects as the table owner, which is exempt. Do not add a policy or `FORCE ROW LEVEL SECURITY` without deciding to expose a table.
- Migration drift was checked on 2026-10-27 and fixed (see `docs/engineering/DECISIONS.md` D010); `prisma migrate diff` reports none.
- Moderator/admin roles exist in the `users.role` column but there is no UI or endpoint to assign them; set them in the database (see the manual check).
