# Technical Architecture

## Architecture goal
Ship a reliable, small, web-first MVP in 1–2 months using the developer's existing JavaScript, React, and Node.js skills.

## Recommended default
- Frontend: React + TypeScript + Vite.
- Routing: React Router.
- Styling: Tailwind CSS (or the existing styling system if one already exists).
- Backend: Node.js + Express + TypeScript.
- Database: PostgreSQL.
- ORM/migrations: Prisma.
- Auth: Supabase Auth or another managed provider.
- Hosting: Vercel for frontend; Render/Railway for API; managed PostgreSQL/Supabase.
- Tests: Vitest, Supertest, Playwright.

Do not install all of these before checking the repository. If a starter already exists, keep its stack unless there is a strong reason to change it.

## Simpler alternative
React + Supabase Auth/PostgreSQL can reduce backend code. Add a Node service only for privileged operations, external API calls, moderation tasks, or future AI integration. Never expose service-role keys in the browser.

## Logical components
1. Web UI — public pages and authenticated forms.
2. API/business logic — input validation, authorization, external API calls, rate limits.
3. PostgreSQL — canonical records and relationships.
4. External film metadata provider — metadata only, subject to provider terms.
5. Optional AI provider — not needed for MVP.

## Security basics
- Validate request bodies and query parameters.
- Enforce author/admin permissions on server and database.
- Apply Row Level Security if using Supabase with exposed tables.
- Keep secrets in environment variables.
- Rate-limit sign-in, creation, and report endpoints.
- Escape or safely render user content; avoid unsafe HTML injection.
- Add CSRF protection where relevant to the chosen auth/session setup.
- Use secure cookies and HTTPS in production.
- Log moderation actions without logging secrets.
- Include deletion and account-management paths appropriate to the auth provider.

## Observability
For MVP, structured server logs and basic error monitoring are sufficient. Do not collect sensitive user behaviour unnecessarily.

## Deployment
Use separate development and production environments. Apply migrations deliberately, document environment variables in `.env.example`, and never commit `.env` files containing secrets.
