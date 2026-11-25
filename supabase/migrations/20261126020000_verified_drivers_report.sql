-- Only verified drivers post road reports (docs/decisions.md, 26 Nov 2026).
--
-- A driver must be vouched by their agent or have passed the optional
-- Aadhaar QR check (verification level agent_vouched, aadhaar_qr or
-- official) before submit_report() accepts a report from them. Aadhaar is
-- never the only way: agent vouching always works. Agents, police and admins
-- post as before. The API checks the same thing first (POST /api/v1/reports).
--
-- Same signature as before, so this replaces the function in place.

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
  -- Drivers post only once verified: vouched by their agent or through the
  -- optional Aadhaar QR check (docs/decisions.md, 26 Nov 2026). Never
  -- Aadhaar alone: vouching is always another way in.
  if v_role = 'driver' and not private.is_verified(v_level) then
    raise exception 'only verified drivers can post road reports' using errcode = '42501';
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
