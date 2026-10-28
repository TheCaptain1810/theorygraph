-- Row Level Security, deny by default.
--
-- On Supabase every table in the "public" schema is also exposed through its REST API (PostgREST) to
-- anyone holding the project's publishable ("anon") key, which ships in the web bundle. This app never
-- uses that API: the browser only talks to our Express server, which connects to the database directly
-- as the table owner. Enabling RLS with NO policies makes these tables unreachable through the REST API,
-- while the server's own connection (the owner, which is exempt from RLS) is unaffected.
--
-- Do not add a policy (or FORCE ROW LEVEL SECURITY) without a deliberate decision to expose a table.
-- This is harmless on a plain PostgreSQL database such as the local Docker one.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "films" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "interpretations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "counter_readings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "evidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "interpretation_tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "moderation_actions" ENABLE ROW LEVEL SECURITY;
-- Prisma's own bookkeeping table is also visible to the REST API.
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
