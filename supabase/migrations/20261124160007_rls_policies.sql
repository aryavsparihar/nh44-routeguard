-- Who can read and write what (BUILD_PROMPT section 7). This is the second
-- lock: the API checks roles in withApi(), and the database checks again
-- here, so a route that forgets a check still can't leak or change rows.
--
--   private.jwt_sub()   the caller's Clerk user id ("user_..."), null if signed out
--   private.jwt_role()  the caller's role from the Clerk token, null if none
--
-- Calls are wrapped in (select ...) so Postgres works them out once per
-- query, not once per row.
--
-- The secret key (the hourly job, later the queue worker) bypasses all of
-- this, which is why it never goes near app code.

-- ---------------------------------------------------------------------------
-- RLS on for the new tables. With RLS on and no matching policy, a request
-- with the publishable key sees nothing and changes nothing.
-- ---------------------------------------------------------------------------
alter table public.verifications        enable row level security;
alter table public.report_confirmations enable row level security;
alter table public.report_flags         enable row level security;
alter table public.official_updates     enable row level security;
alter table public.road_status          enable row level security;
alter table public.audit_log            enable row level security;
alter table public.idempotency_keys     enable row level security;

-- Signed-out visitors (anon) get nothing from tables about people.
revoke all on public.users, public.reports, public.shipments, public.verifications,
  public.report_confirmations, public.report_flags, public.audit_log,
  public.idempotency_keys
  from anon;

-- ===========================================================================
-- Public data
-- ===========================================================================

-- incidents: only rows a second person has checked against the source
-- (section 14). Replaces the Phase 0 "read everything" policy.
drop policy "Public read incidents" on public.incidents;
create policy "Public read verified incidents" on public.incidents
  for select to anon, authenticated
  using (verified_by is not null);

create policy "Public read road_status" on public.road_status
  for select to anon, authenticated
  using (true);

create policy "Admins update road_status" on public.road_status
  for update to authenticated
  using ((select private.jwt_role()) = 'admin')
  with check ((select private.jwt_role()) = 'admin');

-- official_updates: everyone sees live ones; police and admin also see
-- deleted ones (for the history) and are the only ones who can write.
create policy "Public read official updates" on public.official_updates
  for select to anon, authenticated
  using (deleted_at is null);

create policy "Police and admins read all official updates" on public.official_updates
  for select to authenticated
  using ((select private.jwt_role()) in ('police', 'admin'));

create policy "Police and admins add official updates" on public.official_updates
  for insert to authenticated
  with check (
    (select private.jwt_role()) in ('police', 'admin')
    and created_by = (select private.jwt_sub())
    and deleted_at is null
  );

-- Edits and soft deletes are updates. There is no delete policy, so rows
-- can't be removed for real.
create policy "Police and admins edit official updates" on public.official_updates
  for update to authenticated
  using ((select private.jwt_role()) in ('police', 'admin'))
  with check ((select private.jwt_role()) in ('police', 'admin'));

-- ===========================================================================
-- users
-- ===========================================================================

-- Column grants: a user may only ever write these columns of their own row.
-- role, verification_level and agent_id can't be changed with a user token
-- at all; only server functions (A4) change them.
revoke insert, update on public.users from authenticated;
grant insert (id, role, display_name, language, location_consent, consent_version)
  on public.users to authenticated;
grant update (display_name, language, location_consent, consent_version)
  on public.users to authenticated;

create policy "Users read their own row" on public.users
  for select to authenticated
  using (id = (select private.jwt_sub()));

create policy "Agents read their drivers" on public.users
  for select to authenticated
  using ((select private.jwt_role()) = 'agent' and agent_id = (select private.jwt_sub()));

create policy "Admins read all users" on public.users
  for select to authenticated
  using ((select private.jwt_role()) = 'admin');

-- Onboarding: you create your own row once, with a self-service role.
-- police and admin are never self-service (section 8).
create policy "Users create their own row with a self-service role" on public.users
  for insert to authenticated
  with check (
    id = (select private.jwt_sub())
    and role in ('grower', 'trader', 'agent', 'driver')
  );

create policy "Users update their own row" on public.users
  for update to authenticated
  using (id = (select private.jwt_sub()))
  with check (id = (select private.jwt_sub()));

-- ===========================================================================
-- reports
-- ===========================================================================

-- The public map reads this view: no user_id, no photo path, no hidden rows.
-- It runs with the owner's rights (security_invoker = false) so signed-out
-- visitors can read it while the reports table itself stays closed.
create view public.public_reports
with (security_invoker = false) as
select id, source, hazard_type, location, zone_id, note, status,
       confirmations, created_at, expires_at, is_demo
from public.reports
where status::text <> 'hidden';

-- A one-table view is writable by default, and writes through it would skip
-- RLS. So: read-only for everyone.
revoke all on public.public_reports from public, anon, authenticated;
grant select on public.public_reports to anon, authenticated;

create policy "Authors read their own reports" on public.reports
  for select to authenticated
  using (user_id = (select private.jwt_sub()));

create policy "Admins read all reports" on public.reports
  for select to authenticated
  using ((select private.jwt_role()) = 'admin');

-- A new report is always yours, unconfirmed, with no confirmations, and its
-- source must match your role. ::text so the new enum values work in the same
-- push that added them.
create policy "Users add reports as themselves" on public.reports
  for insert to authenticated
  with check (
    user_id = (select private.jwt_sub())
    and status::text = 'unconfirmed'
    and confirmations = 0
    and hidden_reason is null
    and (
         (source::text = 'driver' and (select private.jwt_role()) in ('driver', 'agent'))
      or (source::text = 'police' and (select private.jwt_role()) = 'police')
      or (source::text = 'admin'  and (select private.jwt_role()) = 'admin')
    )
  );

-- Users can't edit reports. Admins hide or resolve them (with a reason).
create policy "Admins update reports" on public.reports
  for update to authenticated
  using ((select private.jwt_role()) = 'admin')
  with check ((select private.jwt_role()) = 'admin');

-- ===========================================================================
-- report_confirmations and report_flags
-- ===========================================================================
create policy "Users read their own confirmations" on public.report_confirmations
  for select to authenticated
  using (user_id = (select private.jwt_sub()) or (select private.jwt_role()) = 'admin');

create policy "Trusted roles confirm other people's reports" on public.report_confirmations
  for insert to authenticated
  with check (
    user_id = (select private.jwt_sub())
    and (select private.jwt_role()) in ('driver', 'agent', 'police', 'admin')
    and private.report_author(report_id) is distinct from (select private.jwt_sub())
  );

create policy "Users read their own flags" on public.report_flags
  for select to authenticated
  using (user_id = (select private.jwt_sub()) or (select private.jwt_role()) = 'admin');

create policy "Signed-in users flag reports as themselves" on public.report_flags
  for insert to authenticated
  with check (user_id = (select private.jwt_sub()));

-- ===========================================================================
-- shipments: the owner agent, the grower/trader who created it, and the
-- assigned driver. Admins read all.
-- ===========================================================================
create policy "People on a shipment read it" on public.shipments
  for select to authenticated
  using (
    agent_id = (select private.jwt_sub())
    or created_by = (select private.jwt_sub())
    or driver_id = (select private.jwt_sub())
    or (select private.jwt_role()) = 'admin'
  );

create policy "Growers, traders and agents create shipments" on public.shipments
  for insert to authenticated
  with check (
    created_by = (select private.jwt_sub())
    and (select private.jwt_role()) in ('grower', 'trader', 'agent')
  );

-- Only the owner agent changes a shipment, and can't hand it to another agent.
-- The driver's location update goes through a server function (WP-B).
create policy "The owner agent updates a shipment" on public.shipments
  for update to authenticated
  using ((select private.jwt_role()) = 'agent' and agent_id = (select private.jwt_sub()))
  with check (agent_id = (select private.jwt_sub()));

-- ===========================================================================
-- verifications: admins read. Rows are added only by server functions
-- (agent vouch in A4, Aadhaar QR in P1), never directly by a user.
-- ===========================================================================
revoke insert, update, delete on public.verifications from authenticated;

create policy "Admins read verifications" on public.verifications
  for select to authenticated
  using ((select private.jwt_role()) = 'admin');

-- ===========================================================================
-- audit_log: admins read; rows come only from write_audit(); nobody, not even
-- the database owner, can change or delete a row.
-- ===========================================================================
revoke insert, update, delete, truncate on public.audit_log from authenticated;

create policy "Admins read the audit log" on public.audit_log
  for select to authenticated
  using ((select private.jwt_role()) = 'admin');

create or replace function private.audit_log_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_log is append-only: rows can''t be changed or deleted'
    using errcode = '42501';
end;
$$;

create trigger audit_log_no_update_or_delete
  before update or delete on public.audit_log
  for each row execute function private.audit_log_append_only();

create trigger audit_log_no_truncate
  before truncate on public.audit_log
  for each statement execute function private.audit_log_append_only();

-- The only way to add an audit row. The actor comes from the caller's token,
-- so nobody can write an entry in someone else's name.
create or replace function public.write_audit(
  p_action      text,
  p_target_type text  default null,
  p_target_id   text  default null,
  p_reason      text  default null,
  p_request_id  text  default null,
  p_meta        jsonb default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id bigint;
begin
  if private.jwt_sub() is null then
    raise exception 'write_audit needs a signed-in caller' using errcode = '42501';
  end if;

  insert into public.audit_log
    (actor_id, actor_role, action, target_type, target_id, reason, request_id, meta)
  values
    (private.jwt_sub(), private.jwt_role(), p_action, p_target_type, p_target_id,
     p_reason, p_request_id, p_meta)
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.write_audit(text, text, text, text, text, jsonb) from public, anon;
grant execute on function public.write_audit(text, text, text, text, text, jsonb) to authenticated;

-- ===========================================================================
-- idempotency_keys: your own only.
-- ===========================================================================
create policy "Users read their own idempotency keys" on public.idempotency_keys
  for select to authenticated
  using (user_id = (select private.jwt_sub()));

create policy "Users save their own idempotency keys" on public.idempotency_keys
  for insert to authenticated
  with check (user_id = (select private.jwt_sub()));
