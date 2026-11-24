-- risk_scores: a reason code the app can translate (section 21, A6).
-- incidents: evidence columns so every number can be traced (section 14).

-- ---------------------------------------------------------------------------
-- risk_scores
-- ---------------------------------------------------------------------------
alter table public.risk_scores
  -- e.g. 'heavy_rain_3h'; the app turns it into English, Hindi or Urdu.
  add column reason_code text check (char_length(reason_code) <= 60),
  -- the numbers that go into that sentence, e.g. {"mm": 42, "hours": 3}
  add column reason_params jsonb check (jsonb_typeof(reason_params) = 'object');

comment on column public.risk_scores.reason is
  'English reason, kept for older clients. New clients use reason_code + reason_params.';

-- Same view as before, with the two new columns added at the end.
create or replace view public.latest_risk
with (security_invoker = true) as
select
  rs.id,
  rs.run_at,
  rs.zone_id,
  z.name as zone_name,
  rs.h3_index,
  rs.horizon_hours,
  rs.landslide,
  rs.rockfall,
  rs.flash_flood,
  rs.snow_ice,
  rs.overall,
  rs.risk_low,
  rs.risk_high,
  rs.level,
  rs.top_hazard,
  rs.confidence,
  rs.reason,
  rs.model_version,
  rs.reason_code,
  rs.reason_params
from public.risk_scores rs
join public.zones z on z.id = rs.zone_id
where rs.run_at = (select max(run_at) from public.risk_scores);

-- ---------------------------------------------------------------------------
-- incidents
-- The existing "date" column is the event start date. It keeps its name so
-- seed.js and the risk job don't break.
-- ---------------------------------------------------------------------------
comment on column public.incidents.date is 'Event start date (not the article date). See date_basis.';

alter table public.incidents
  add column event_end_date date,
  -- stated = written out in the source; inferred_weekday = "on Monday" worked
  -- out to a date; article_date = only the article date is known.
  add column date_basis text check (date_basis in ('stated', 'inferred_weekday', 'article_date')),
  add column coord_basis text check (char_length(coord_basis) <= 40),   -- e.g. osm_place
  add column hours_basis text check (char_length(hours_basis) <= 200),
  add column vehicles_stranded integer check (vehicles_stranded >= 0),
  add column apple_trucks_mentioned boolean,
  add column source_publisher text check (char_length(source_publisher) <= 120),
  add column source_published_date date,
  -- The exact words (up to 25) that support the numbers and the date.
  add column evidence_quote text check (
    array_length(regexp_split_to_array(btrim(evidence_quote), '\s+'), 1) <= 25
  ),
  add column archive_url text check (archive_url like 'https://%'),
  add column second_source_url text check (second_source_url like 'https://%'),
  add column added_by text check (char_length(added_by) <= 60),
  add column verified_by text check (char_length(verified_by) <= 60),
  add column verified_on date,
  add column confidence public.confidence_level,
  add column notes text check (char_length(notes) <= 500),
  add column is_demo boolean not null default false,
  add constraint incidents_end_after_start check (event_end_date >= date),
  add constraint incidents_source_https check (source_url like 'https://%'),
  -- Two people per row: the verifier can't be the person who added it.
  add constraint incidents_verifier_differs check (verified_by <> added_by),
  add constraint incidents_verified_has_date check (verified_by is null or verified_on is not null);

-- "No quote, no number" (section 14). NOT VALID: checked for every new or
-- changed row, but the 6 Phase 0 rows (which have numbers and no quote) are
-- left as they are until Madhusudan's verified CSV replaces them.
alter table public.incidents
  add constraint incidents_numbers_need_quote check (
    (hours_closed is null and trucks_stranded is null and vehicles_stranded is null)
    or evidence_quote is not null
  ) not valid;
