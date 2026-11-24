-- Small helpers so every RLS policy reads the same way.
--
-- They live in a "private" schema. The Supabase API only exposes "public",
-- so nobody can call these through /rest/v1/rpc. Policies can still use
-- them because signed-in users get USAGE and EXECUTE below.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

-- The Clerk user id of the caller ("user_..."), or null when signed out.
create or replace function private.jwt_sub()
returns text
language sql
stable
set search_path = ''
as $$
  select auth.jwt() ->> 'sub'
$$;

-- The caller's role from the Clerk session token (metadata.role, set from
-- Clerk publicMetadata, which users can't edit), or null.
create or replace function private.jwt_role()
returns text
language sql
stable
set search_path = ''
as $$
  select auth.jwt() -> 'metadata' ->> 'role'
$$;

-- Who wrote a report. SECURITY DEFINER so a policy can check "you can't
-- confirm your own report" without letting the caller read reports.user_id.
create or replace function private.report_author(p_report_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select user_id from public.reports where id = p_report_id
$$;

revoke all on all functions in schema private from public;
grant execute on function private.jwt_sub(), private.jwt_role() to anon, authenticated;
grant execute on function private.report_author(uuid) to authenticated;
