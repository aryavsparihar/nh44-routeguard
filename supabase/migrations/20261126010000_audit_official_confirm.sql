-- Audit police and admin confirmations of road reports (docs/guardrails.md,
-- rule 3: every privileged action goes into the audit log).
--
-- One police or admin "I see it too" confirms a report by itself, but until
-- now it was only a row in report_confirmations. confirm_report() now also
-- calls public.write_audit('report.official_confirm', ...) for those, with
-- the request id and the distance to the report (no position is kept).
--
-- The new p_request_id parameter has a default, so callers that still pass
-- four arguments keep working while the app is updated.

drop function if exists private.confirm_report(uuid, double precision, double precision, jsonb);

create or replace function private.confirm_report(
  p_report_id uuid,
  p_lat       double precision,
  p_lng       double precision,
  p_rules     jsonb,
  p_request_id text default null
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

  -- One police or admin confirmation makes a report confirmed on its own,
  -- so it is a privileged action: audit it (guardrail 3). Repeats and
  -- confirmations by drivers or agents are not audited.
  if v_rows = 1 and v_role in ('police', 'admin') then
    perform public.write_audit('report.official_confirm', 'report', p_report_id::text, null, p_request_id,
      jsonb_build_object('distance_m', v_dist));
  end if;

  return query
    select r.status::text, r.confirmations, case when v_rows = 1 then 'confirmed' else 'repeat' end
    from public.reports r where r.id = p_report_id;
end;
$$;

revoke all on function private.confirm_report(uuid, double precision, double precision, jsonb, text) from public;
grant execute on function private.confirm_report(uuid, double precision, double precision, jsonb, text) to authenticated;
