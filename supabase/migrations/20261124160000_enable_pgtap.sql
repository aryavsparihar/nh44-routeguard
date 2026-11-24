-- pgTAP lets us write database tests in SQL (supabase/tests/).
-- Used only by `npx supabase test db`; the app never calls it.
create extension if not exists pgtap with schema extensions;
