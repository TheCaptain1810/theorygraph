# Environment and Setup Notes

This file documents expected configuration. Use `.env.example` in the actual app repository and never commit real secrets.

## Likely environment variables
- `DATABASE_URL` — PostgreSQL connection string, server only. For Supabase use the Session pooler URI (`postgres.<project-ref>` user, port 5432); URL-encode special characters in the password. Never reuse it for tests.
- `TMDB_API_KEY` — only if a permitted TMDB integration is used server-side.
- `SUPABASE_URL` — if using Supabase.
- `SUPABASE_ANON_KEY` — public client key, with RLS configured correctly.
- `SUPABASE_SERVICE_ROLE_KEY` — server-only; never expose to browser.
- `SESSION_SECRET` — if using server-managed sessions.
- `LLM_API_KEY` — omit until an AI feature is deliberately added.

Only include variables required by the chosen architecture.

## Setup checklist
- Install supported Node.js LTS.
- Install dependencies using the package manager selected by the repository.
- Create local environment file from `.env.example`.
- Start local PostgreSQL or configure a development database.
- Run migrations.
- Seed a small set of film records and clearly labelled sample interpretations.
- Run lint, type-check, unit tests, and e2e tests.
- Confirm public pages work without login and write actions require authentication.

## External service checklist
- Review provider terms, attribution requirements, caching restrictions, and commercial licensing.
- Never assume an image or movie still can be redistributed because it is publicly visible.
- Configure separate development and production keys.

## Variables used by the starter
`SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY` take the project's publishable key (`sb_publishable_...`), the successor to the anon key.
Server (`server/.env.example`): `DATABASE_URL`, `TMDB_API_KEY`, `PORT`, `WEB_ORIGIN`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, optional `TEST_DATABASE_URL`.
Web (`web/.env.example`): `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
`TMDB_API_KEY` (server only; optional, film search/import return 503 without it). `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET` and `LLM_API_KEY` are not used yet.

## End-to-end test variables
`e2e/.env` (gitignored; template in `e2e/.env.example`): `E2E_USERNAME`, `E2E_EMAIL`, `E2E_PASSWORD` for an existing, email-confirmed Supabase account, and optional `E2E_DATABASE_URL` (default `postgresql://postgres:postgres@localhost:5432/theorygraph_e2e`; the name must end in `_e2e` because the database is wiped each run). Real environment variables override the file.
