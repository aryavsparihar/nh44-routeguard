-- Road reports: writing, confirming, flagging (B2), with the trust rules of
-- BUILD_PROMPT section 9.
--
-- The rules need to read and change rows the caller can't (other people's
-- reports, everyone's confirmations), so they run in SECURITY DEFINER
-- functions. Those live in the private schema: Supabase's REST API doesn't
-- expose it, so only the app's own database login can call them, always as
-- the signed-in caller (private.jwt_sub(), private.jwt_role()). Every function
-- checks who is calling before it does anything.
--
-- The numbers (expiry hours, 500 m / 60 min duplicates, 2 confirmations
-- within 2 km / 3 h, 3 flags) come from config/report-rules.json; the app
-- passes that file in as p_rules, so there is one place to change them.

-- ---------------------------------------------------------------------------
-- How far a confirmer was from the report, in metres (rounded). Their own
-- position is not stored.
-- ---------------------------------------------------------------------------
alter table public.report_confirmations
  add column distance_m integer check (distance_m >= 0);

-- The public view says whether a report has a photo; the storage path stays
-- private (GET /api/v1/reports/{id}/photo hands out a short-lived link).
create or replace view public.public_reports
with (security_invoker = false) as
select id, source, hazard_type, location, zone_id, note, status,
       confirmations, created_at, expires_at, is_demo,
       photo_path is not null as has_photo
from public.reports
where status::text <> 'hidden';

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Levels that count as "verified" (section 9): vouched by an agent, Aadhaar
-- QR, or official (police and admin).
create or replace function private.is_verified(p_level public.verification_level)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_level::text in ('agent_vouched', 'aadhaar_qr', 'official')
$$;

-- Reads one whole number from the rules JSON and checks its range, so a bad
-- config fails loudly instead of quietly turning a rule off.
create or replace function private.rule_int(p_rules jsonb, p_path text[], p_min integer, p_max integer)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  v integer;
begin
  v := (p_rules #>> p_path)::integer;
  if v is null or v < p_min or v > p_max then
    raise exception 'report rule % is missing or out of range', array_to_string(p_path, '.') using errcode = '22023';
  end if;
  return v;
end;
$$;

-- Recounts a report's confirmations and promotes it to confirmed when
-- police/admin confirmed it, or when enough verified people near it
-- confirmed it soon enough after it was posted.
create or replace function private.recount_report(p_report_id uuid, p_rules jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_needed     integer := private.rule_int(p_rules, '{confirm,needed}', 1, 10);
  v_within_m   integer := private.rule_int(p_rules, '{confirm,within_m}', 1, 50000);
  v_within_h   integer := private.rule_int(p_rules, '{confirm,within_hours}', 1, 48);
  v_created    timestamptz;
  v_total      integer;
  v_verified   integer;
  v_official   boolean;
begin
  select r.created_at into v_created from public.reports r where r.id = p_report_id for update;

  select count(*)::integer,
         (count(*) filter (
            where private.is_verified(u.verification_level)
              and c.distance_m is not null and c.distance_m <= v_within_m
              and c.created_at <= v_created + make_interval(hours => v_within_h)))::integer,
         coalesce(bool_or(u.role::text in ('police', 'admin')), false)
    into v_total, v_verified, v_official
  from public.report_confirmations c
  join public.users u on u.id = c.user_id
  where c.report_id = p_report_id;

  update public.reports r
  set confirmations = v_total,
      status = case
        when r.status::text = 'unconfirmed' and (v_official or v_verified >= v_needed)
          then 'confirmed'::public.report_status
        else r.status
      end
  where r.id = p_report_id;
end;
$$;

-- A photo can be read when its report is not hidden.
create or replace function private.report_photo_visible(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.reports r
    where r.photo_path = p_name and r.status::text <> 'hidden'
  )
$$;

-- The storage path of a visible report's photo, or null.
create or replace function private.report_photo_path(p_report_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select r.photo_path from public.reports r
  where r.id = p_report_id and r.status::text <> 'hidden'
$$;

-- ---------------------------------------------------------------------------
-- submit_report: a new road report from a driver, agent, police or admin.
--
--   repeat   the same phone report again (same client id): the first answer
--   merged   the same hazard within 500 m and 60 min is already on the map:
--            this counts as a confirmation of it, not a new pin
--   created  a new report; "confirmed" at once from police, admin or a
--            verified driver, otherwise "unconfirmed"
-- ---------------------------------------------------------------------------
create or replace function private.submit_report(
  p_client_id  uuid,
  p_hazard     public.hazard_type,
  p_lat        double precision,
  p_lng        double precision,
  p_zone_id    smallint,
  p_note       text,
  p_photo_path text,
  p_rules      jsonb,
  p_is_demo    boolean default false
)
returns table (report_id uuid, status text, outcome text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub      text := private.jwt_sub();
  v_role     text := private.jwt_role();
  v_level    public.verification_level;
  v_source   public.report_source;
  v_status   public.report_status;
  v_point    extensions.geography;
  v_hours    integer;
  v_dup_m    integer := private.rule_int(p_rules, '{duplicate,within_m}', 0, 5000);
  v_dup_min  integer := private.rule_int(p_rules, '{duplicate,within_minutes}', 0, 1440);
  v_found    record;
  v_id       uuid;
begin
  if v_sub is null then
    raise exception 'submit_report needs a signed-in caller' using errcode = '42501';
  end if;
  if v_role is null or v_role not in ('driver', 'agent', 'police', 'admin') then
    raise exception 'this role can''t post road reports' using errcode = '42501';
  end if;
  if p_client_id is null or p_hazard is null or p_lat is null or p_lng is null then
    raise exception 'submit_report: missing arguments' using errcode = '22023';
  end if;
  if p_photo_path is not null and p_photo_path <> v_sub || '/' || p_client_id::text || '.webp' then
    raise exception 'submit_report: photo path must be the caller''s own' using errcode = '42501';
  end if;
  v_hours := private.rule_int(p_rules, array['expiry_hours', p_hazard::text], 1, 48);

  select u.verification_level into v_level from public.users u where u.id = v_sub;
  if not found then
    raise exception 'submit_report: no users row for the caller' using errcode = '23503';
  end if;

  -- One report of each hazard type at a time, so two phones reporting the
  -- same rockfall at the same second can't both make a pin.
  perform pg_advisory_xact_lock(hashtext('report:' || p_hazard::text));

  -- The phone sent this report before (a retry after a dropped connection).
  select r.id, r.user_id, r.status::text as st into v_found
  from public.reports r where r.client_id = p_client_id;
  if found then
    if v_found.user_id is distinct from v_sub then
      raise exception 'submit_report: this client id belongs to another report' using errcode = '23505';
    end if;
    return query select v_found.id, v_found.st, 'repeat'::text;
    return;
  end if;

  v_point := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;

  -- The same hazard close by, posted a short while ago and still on the map.
  select r.id, r.user_id, extensions.st_distance(r.location, v_point) as dist into v_found
  from public.reports r
  where r.hazard_type = p_hazard
    and r.status::text in ('unconfirmed', 'confirmed')
    and r.expires_at > now()
    and r.created_at > now() - make_interval(mins => v_dup_min)
    and extensions.st_dwithin(r.location, v_point, v_dup_m)
  order by r.created_at
  limit 1;
  if found then
    if v_found.user_id is distinct from v_sub then
      insert into public.report_confirmations (report_id, user_id, distance_m)
      values (v_found.id, v_sub, round(v_found.dist)::integer)
      on conflict do nothing;
      perform private.recount_report(v_found.id, p_rules);
    end if;
    return query select r.id, r.status::text, 'merged'::text from public.reports r where r.id = v_found.id;
    return;
  end if;

  v_source := case v_role when 'police' then 'police' when 'admin' then 'admin' else 'driver' end::public.report_source;
  v_status := case
    when v_source::text in ('police', 'admin') or private.is_verified(v_level) then 'confirmed'
    else 'unconfirmed'
  end::public.report_status;

  insert into public.reports
    (user_id, source, hazard_type, location, zone_id, photo_path, note, status, client_id, expires_at, is_demo)
  values
    (v_sub, v_source, p_hazard, v_point, p_zone_id, p_photo_path, p_note, v_status, p_client_id,
     now() + make_interval(hours => v_hours), coalesce(p_is_demo, false))
  returning id into v_id;

  return query select v_id, v_status::text, 'created'::text;
end;
$$;

-- ---------------------------------------------------------------------------
-- confirm_report: "I see it too". Verified drivers, agents, police and admins;
-- once per person; never your own report. p_lat/p_lng are where the
-- confirmer is now (optional); only the distance is kept.
-- ---------------------------------------------------------------------------
create or replace function private.confirm_report(
  p_report_id uuid,
  p_lat       double precision,
  p_lng       double precision,
  p_rules     jsonb
)
returns table (status text, confirmations integer, outcome text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub    text := private.jwt_sub();
  v_role   text := private.jwt_role();
  v_level  public.verification_level;
  v_report record;
  v_dist   integer;
  v_rows   integer;
begin
  if v_sub is null then
    raise exception 'confirm_report needs a signed-in caller' using errcode = '42501';
  end if;
  if v_role is null or v_role not in ('driver', 'agent', 'police', 'admin') then
    raise exception 'this role can''t confirm reports' using errcode = '42501';
  end if;

  select u.verification_level into v_level from public.users u where u.id = v_sub;
  if not found then
    raise exception 'confirm_report: no users row for the caller' using errcode = '23503';
  end if;
  if v_role = 'driver' and not private.is_verified(v_level) then
    raise exception 'only verified drivers can confirm reports' using errcode = '42501';
  end if;

  select r.id, r.user_id, r.status::text as st, r.expires_at, r.location into v_report
  from public.reports r where r.id = p_report_id;
  if not found or v_report.st = 'hidden' then
    raise exception 'no such report' using errcode = 'P0002';
  end if;
  if v_report.user_id = v_sub then
    raise exception 'you can''t confirm your own report' using errcode = '42501';
  end if;
  if v_report.st not in ('unconfirmed', 'confirmed') or v_report.expires_at <= now() then
    raise exception 'this report is no longer on the map' using errcode = '55000';
  end if;

  if p_lat is not null and p_lng is not null then
    v_dist := round(extensions.st_distance(
      v_report.location,
      extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography))::integer;
  end if;

  insert into public.report_confirmations (report_id, user_id, distance_m)
  values (p_report_id, v_sub, v_dist)
  on conflict do nothing;
  get diagnostics v_rows = row_count;

  perform private.recount_report(p_report_id, p_rules);

  return query
    select r.status::text, r.confirmations, case when v_rows = 1 then 'confirmed' else 'repeat' end
    from public.reports r where r.id = p_report_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- flag_report: "this is wrong". Any signed-in user, once per report. Three
-- flags from different people hide an unconfirmed report until an admin
-- looks at it.
-- ---------------------------------------------------------------------------
create or replace function private.flag_report(
  p_report_id uuid,
  p_reason    public.flag_reason,
  p_rules     jsonb
)
returns table (status text, outcome text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub    text := private.jwt_sub();
  v_hide   integer := private.rule_int(p_rules, '{hide_after_flags}', 2, 20);
  v_st     text;
  v_rows   integer;
  v_flags  integer;
begin
  if v_sub is null then
    raise exception 'flag_report needs a signed-in caller' using errcode = '42501';
  end if;
  if not exists (select 1 from public.users u where u.id = v_sub) then
    raise exception 'flag_report: no users row for the caller' using errcode = '23503';
  end if;

  select r.status::text into v_st from public.reports r where r.id = p_report_id for update;
  if not found or v_st = 'hidden' then
    raise exception 'no such report' using errcode = 'P0002';
  end if;

  insert into public.report_flags (report_id, user_id, reason)
  values (p_report_id, v_sub, p_reason)
  on conflict on constraint report_flags_once_per_user do nothing;
  get diagnostics v_rows = row_count;

  select count(distinct f.user_id)::integer into v_flags from public.report_flags f where f.report_id = p_report_id;
  if v_st = 'unconfirmed' and v_flags >= v_hide then
    update public.reports r
    set status = 'hidden', hidden_reason = 'Hidden after ' || v_flags || ' flags; waiting for an admin'
    where r.id = p_report_id;
    v_st := 'hidden';
  end if;

  return query select v_st, case when v_rows = 1 then 'flagged' else 'repeat' end;
end;
$$;

-- ---------------------------------------------------------------------------
-- Who may call what. Only signed-in callers (the app's login as
-- authenticated) write; anyone may check whether a photo is visible.
-- ---------------------------------------------------------------------------
revoke all on function private.is_verified(public.verification_level) from public;
revoke all on function private.rule_int(jsonb, text[], integer, integer) from public;
revoke all on function private.recount_report(uuid, jsonb) from public, anon, authenticated;
revoke all on function private.report_photo_visible(text) from public;
revoke all on function private.report_photo_path(uuid) from public;
revoke all on function private.submit_report(uuid, public.hazard_type, double precision, double precision, smallint, text, text, jsonb, boolean) from public;
revoke all on function private.confirm_report(uuid, double precision, double precision, jsonb) from public;
revoke all on function private.flag_report(uuid, public.flag_reason, jsonb) from public;

grant execute on function private.report_photo_visible(text) to anon, authenticated;
grant execute on function private.report_photo_path(uuid) to anon, authenticated;
grant execute on function private.submit_report(uuid, public.hazard_type, double precision, double precision, smallint, text, text, jsonb, boolean) to authenticated;
grant execute on function private.confirm_report(uuid, double precision, double precision, jsonb) to authenticated;
grant execute on function private.flag_report(uuid, public.flag_reason, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Photos: a private bucket. The server strips EXIF and re-encodes every photo
-- as WebP before upload, with the reporter's own Clerk token, into a folder
-- named after their user id. Anyone can read a photo whose report is not
-- hidden, through a signed link that expires in 10 minutes.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report-photos', 'report-photos', false, 2097152, array['image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "Reporters upload into their own photo folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'report-photos'
    and (storage.foldername(name))[1] = (select private.jwt_sub())
    and (select private.jwt_role()) in ('driver', 'agent', 'police', 'admin')
  );

-- Needed for a retry that uploads the same file again (upsert).
create policy "Reporters replace photos in their own folder" on storage.objects
  for update to authenticated
  using (bucket_id = 'report-photos' and (storage.foldername(name))[1] = (select private.jwt_sub()))
  with check (bucket_id = 'report-photos' and (storage.foldername(name))[1] = (select private.jwt_sub()));

create policy "Reporters remove photos from their own folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'report-photos' and (storage.foldername(name))[1] = (select private.jwt_sub()));

create policy "Photos of visible reports, and your own, can be read" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'report-photos'
    and (
      private.report_photo_visible(name)
      or (storage.foldername(name))[1] = (select private.jwt_sub())
    )
  );
