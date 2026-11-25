-- Shipments, the agent's fleet and account deletion (B5/D4, D2).
--
--   agent_invites           an agent's one-time codes; a driver who types one
--                           joins that agent's fleet (users.agent_id)
--   private.create_agent_invite, accept_agent_invite, vouch_driver
--   shipments               one active shipment per truck, column grants,
--                           drivers only from your own fleet, coarse location
--   private.shipment_location   the assigned driver's position, ~1 km
--   private.delete_my_account   deletes your row; your reports stay, anonymised
--   Realtime                shipments changes go to subscribers, filtered by RLS
--
-- Every function here is security definer in the private schema (Supabase's
-- REST API can't reach it), checks the caller's role from the token itself,
-- and is only granted to authenticated.

-- ===========================================================================
-- agent_invites
-- ===========================================================================
create table public.agent_invites (
  code         text primary key check (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  agent_id     text not null references public.users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  accepted_by  text references public.users (id) on delete set null,
  accepted_at  timestamptz,
  constraint agent_invites_expiry check (expires_at > created_at),
  constraint agent_invites_accepted_pair check ((accepted_by is null) = (accepted_at is null))
);

create index agent_invites_agent_id_idx on public.agent_invites (agent_id, created_at desc);

alter table public.agent_invites enable row level security;
revoke all on public.agent_invites from anon;
revoke insert, update, delete on public.agent_invites from authenticated;

create policy "Agents read their own invites" on public.agent_invites
  for select to authenticated
  using (agent_id = (select private.jwt_sub()));

-- An 8-character code from 32 letters and digits that can't be confused
-- (no I, O, 0 or 1), valid for p_days days. At most 20 open codes per agent.
create or replace function private.create_agent_invite(p_days integer default 7)
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub      text := private.jwt_sub();
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes    bytea;
  v_code     text;
  v_open     integer;
begin
  if v_sub is null or private.jwt_role() is distinct from 'agent' then
    raise exception 'only agents create invites' using errcode = '42501';
  end if;
  if not exists (select 1 from public.users u where u.id = v_sub) then
    raise exception 'finish onboarding first' using errcode = '23503';
  end if;
  if p_days is null or p_days < 1 or p_days > 30 then
    raise exception 'p_days must be 1 to 30' using errcode = '22023';
  end if;

  select count(*) into v_open
  from public.agent_invites i
  where i.agent_id = v_sub and i.accepted_by is null and i.expires_at > now();
  if v_open >= 20 then
    raise exception 'too many open invites' using errcode = '54000';
  end if;

  loop
    v_bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    v_code := '';
    for i in 0..7 loop
      v_code := v_code || substr(v_alphabet, 1 + (get_byte(v_bytes, i) % 32), 1);
    end loop;
    begin
      insert into public.agent_invites (code, agent_id, expires_at)
      values (v_code, v_sub, now() + make_interval(days => p_days));
      exit;
    exception when unique_violation then
      -- a clash in a 32^8 space: try another code
    end;
  end loop;

  return query select i.code, i.expires_at from public.agent_invites i where i.code = v_code;
end;
$$;

-- A driver joins the agent who made the code. Joining a different agent
-- removes an "agent_vouched" level: the new agent has to vouch again.
create or replace function private.accept_agent_invite(p_code text)
returns table (agent_id text, outcome text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub    text := private.jwt_sub();
  v_invite public.agent_invites%rowtype;
  v_old    text;
begin
  if v_sub is null or private.jwt_role() is distinct from 'driver' then
    raise exception 'only drivers accept invites' using errcode = '42501';
  end if;

  select * into v_invite from public.agent_invites i where i.code = upper(p_code) for update;
  if not found then
    raise exception 'no such invite' using errcode = 'P0002';
  end if;

  select u.agent_id into v_old from public.users u where u.id = v_sub for update;
  if not found then
    raise exception 'finish onboarding first' using errcode = '23503';
  end if;

  if v_invite.accepted_by = v_sub then
    return query select v_invite.agent_id, 'repeat'::text;
    return;
  end if;
  if v_invite.accepted_by is not null or v_invite.expires_at <= now() then
    raise exception 'invite used or expired' using errcode = '55000';
  end if;

  update public.agent_invites i set accepted_by = v_sub, accepted_at = now() where i.code = v_invite.code;
  update public.users u
  set agent_id = v_invite.agent_id,
      verification_level = case
        when v_old is distinct from v_invite.agent_id and u.verification_level::text = 'agent_vouched'
        then 'none'::public.verification_level
        else u.verification_level end
  where u.id = v_sub;

  perform public.write_audit('driver.joined_agent', 'user', v_sub, null, null,
                             jsonb_build_object('agent_id', v_invite.agent_id, 'previous_agent_id', v_old));
  return query select v_invite.agent_id, 'joined'::text;
end;
$$;

-- An agent vouches for a driver in their own fleet (PPT: "verified driver").
-- Adds a verifications row and raises the level to agent_vouched; a higher
-- level (Aadhaar QR, official) is kept.
create or replace function private.vouch_driver(p_driver text, p_request_id text default null)
returns table (verification_level text, outcome text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub    text := private.jwt_sub();
  v_driver public.users%rowtype;
begin
  if v_sub is null or private.jwt_role() is distinct from 'agent' then
    raise exception 'only agents vouch' using errcode = '42501';
  end if;

  select * into v_driver from public.users u where u.id = p_driver for update;
  if not found or v_driver.role::text <> 'driver' or v_driver.agent_id is distinct from v_sub then
    -- Same answer for "no such user" and "not your driver": no probing.
    raise exception 'not a driver in your fleet' using errcode = 'P0002';
  end if;

  if v_driver.verification_level::text in ('agent_vouched', 'aadhaar_qr', 'official') then
    return query select v_driver.verification_level::text, 'repeat'::text;
    return;
  end if;

  insert into public.verifications (user_id, method, verdict, verified_by)
  values (p_driver, 'agent_vouch', 'verified', v_sub);
  update public.users u set verification_level = 'agent_vouched' where u.id = p_driver;

  perform public.write_audit('driver.vouched', 'user', p_driver, null, p_request_id, null);
  return query select 'agent_vouched'::text, 'vouched'::text;
end;
$$;

-- ===========================================================================
-- shipments
-- ===========================================================================

-- One active shipment per truck (section 6: 409 on a duplicate active truck).
create unique index shipments_active_truck_idx on public.shipments (truck_number)
  where truck_number is not null and status <> 'delivered'::public.shipment_status;

-- Growers and traders save their own lots (no agent); an agent's shipments
-- are always their own. Nobody can put a shipment on someone else's board.
drop policy "Growers, traders and agents create shipments" on public.shipments;
create policy "Growers, traders and agents create shipments" on public.shipments
  for insert to authenticated
  with check (
    created_by = (select private.jwt_sub())
    and (
         ((select private.jwt_role()) in ('grower', 'trader') and agent_id is null and driver_id is null)
      or ((select private.jwt_role()) = 'agent' and agent_id = (select private.jwt_sub()))
    )
  );

-- Column grants: a user token writes only these columns. Location and
-- last-seen come only from shipment_location(); is_demo only from the seed.
revoke insert, update on public.shipments from authenticated;
grant insert (created_by, agent_id, driver_id, truck_number, variety, tonnes, harvest_date,
              cold_stored, truck_type, origin, destination, status, advice, eta)
  on public.shipments to authenticated;
grant update (status, driver_id, eta) on public.shipments to authenticated;

-- A driver on a shipment must be in the owner agent's fleet.
create or replace function private.shipments_check_driver()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.driver_id is not null
     and (tg_op = 'INSERT' or new.driver_id is distinct from old.driver_id)
     and not exists (
       select 1 from public.users u
       where u.id = new.driver_id and u.role::text = 'driver'
         and new.agent_id is not null and u.agent_id = new.agent_id
     ) then
    raise exception 'driver is not in this agent''s fleet' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger shipments_check_driver
  before insert or update of driver_id on public.shipments
  for each row execute function private.shipments_check_driver();

-- The assigned driver's position, rounded to 0.01° (about 1 km), only with
-- location sharing on, only while the shipment isn't delivered.
create or replace function private.shipment_location(p_id uuid, p_lat double precision, p_lng double precision)
returns table (last_seen_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub  text := private.jwt_sub();
  v_ship public.shipments%rowtype;
begin
  if v_sub is null or private.jwt_role() is distinct from 'driver' then
    raise exception 'only drivers send a location' using errcode = '42501';
  end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'bad position' using errcode = '22023';
  end if;

  select * into v_ship from public.shipments s where s.id = p_id for update;
  if not found or v_ship.driver_id is distinct from v_sub then
    raise exception 'not your shipment' using errcode = 'P0002';
  end if;
  if not coalesce((select u.location_consent from public.users u where u.id = v_sub), false) then
    raise exception 'location sharing is off' using errcode = '55000';
  end if;
  if v_ship.status::text = 'delivered' then
    raise exception 'shipment delivered' using errcode = '55000';
  end if;

  update public.shipments s
  set last_location = extensions.st_setsrid(
        extensions.st_makepoint(round(p_lng::numeric, 2)::double precision, round(p_lat::numeric, 2)::double precision),
        4326)::extensions.geography,
      last_seen_at = now()
  where s.id = p_id;

  return query select s.last_seen_at from public.shipments s where s.id = p_id;
end;
$$;

-- ===========================================================================
-- Account deletion (DELETE /api/v1/me)
-- ===========================================================================
-- Deletes your users row. Your reports stay on the map without your id (the
-- foreign key sets user_id to null) and lose their photo; confirmations,
-- flags and verifications go with the row (on delete cascade); shipments keep
-- running without you. Police and admin accounts are removed by another admin.
-- Reports you confirmed are recounted with the same rules (p_rules, from
-- config/report-rules.json). Returns the photo paths so the app can delete
-- the files.
create or replace function private.delete_my_account(p_rules jsonb, p_request_id text default null)
returns table (photo_path text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub   text := private.jwt_sub();
  v_role  text;
  v_paths text[];
  v_confirmed uuid[];
  v_report uuid;
begin
  if v_sub is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  select u.role::text into v_role from public.users u where u.id = v_sub for update;
  if v_role in ('police', 'admin') then
    raise exception 'ask an admin to remove this account' using errcode = '55000';
  end if;

  select coalesce(array_agg(r.photo_path), '{}') into v_paths
  from public.reports r where r.user_id = v_sub and r.photo_path is not null;
  update public.reports r set photo_path = null where r.user_id = v_sub and r.photo_path is not null;

  -- Written before the row goes, while write_audit can still see the caller.
  perform public.write_audit('user.deleted', 'user', v_sub, null, p_request_id,
                             jsonb_build_object('role', v_role, 'photos', coalesce(array_length(v_paths, 1), 0)));
  select coalesce(array_agg(c.report_id), '{}') into v_confirmed
  from public.report_confirmations c where c.user_id = v_sub;

  delete from public.users u where u.id = v_sub;

  foreach v_report in array v_confirmed loop
    perform private.recount_report(v_report, p_rules);
  end loop;

  return query select unnest(v_paths);
end;
$$;

-- ===========================================================================
-- Grants
-- ===========================================================================
revoke all on function private.create_agent_invite(integer) from public, anon;
revoke all on function private.accept_agent_invite(text) from public, anon;
revoke all on function private.vouch_driver(text, text) from public, anon;
revoke all on function private.shipment_location(uuid, double precision, double precision) from public, anon;
revoke all on function private.delete_my_account(jsonb, text) from public, anon;
revoke all on function private.shipments_check_driver() from public, anon, authenticated;
grant execute on function private.create_agent_invite(integer) to authenticated;
grant execute on function private.accept_agent_invite(text) to authenticated;
grant execute on function private.vouch_driver(text, text) to authenticated;
grant execute on function private.shipment_location(uuid, double precision, double precision) to authenticated;
grant execute on function private.delete_my_account(jsonb, text) to authenticated;

-- ===========================================================================
-- Realtime: the agent board listens to postgres_changes on shipments. Realtime
-- checks the shipments RLS policies with each subscriber's Clerk token, so an
-- agent only receives their own trucks.
-- ===========================================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shipments') then
    alter publication supabase_realtime add table public.shipments;
  end if;
end;
$$;
