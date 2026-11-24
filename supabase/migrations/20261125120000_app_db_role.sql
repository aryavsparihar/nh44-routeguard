-- The login the web app uses for its direct database connection (Drizzle ORM
-- over the Supabase pooler, src/server/db). docs/decisions.md (ORM) explains it.
--
-- routeguard_app can do nothing by itself:
--   * NOINHERIT and membership WITH INHERIT FALSE: it doesn't get the
--     privileges of anon or authenticated just by logging in;
--   * WITH SET TRUE: it may switch to anon or authenticated, which is what
--     getDb().rls() does at the start of every transaction, exactly like
--     Supabase's own API (the authenticator role) does;
--   * NOBYPASSRLS, not a superuser, no other roles.
-- So a query that forgets to switch role gets "permission denied", never
-- rows that RLS would hide.
--
-- No password here: set it yourself in the Supabase SQL editor, never in git
-- (docs/runbook.md, "App database login"):
--   alter role routeguard_app with password '<a long random password>';

create role routeguard_app with login noinherit nobypassrls nocreatedb nocreaterole connection limit 30;

grant anon, authenticated to routeguard_app with inherit false, set true;

comment on role routeguard_app is
  'RouteGuard web app login (Drizzle). Switches to anon or authenticated per transaction; no privileges of its own.';
