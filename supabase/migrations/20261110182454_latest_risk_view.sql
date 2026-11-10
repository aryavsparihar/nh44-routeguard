-- Additive only: nothing existing is changed or dropped.

-- 1. Risk level (low / medium / high) written by the job from lib/risk/config.json
--    (low < 0.30 <= medium <= 0.65 < high; our own starting cut-offs).
alter table public.risk_scores
  add column level text check (level in ('low', 'medium', 'high'));

comment on column public.risk_scores.level is
  'low / medium / high from overall, using the cut-offs in lib/risk/config.json (our own starting values).';

-- 2. Fast lookup of the newest run.
create index risk_scores_run_at_idx on public.risk_scores (run_at desc);

-- 3. latest_risk: every row from the newest run (zones and, later, hexagons).
--    security_invoker = true, so the caller's RLS on risk_scores and zones applies
--    (both already have public read policies).
create view public.latest_risk
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
  rs.model_version
from public.risk_scores rs
join public.zones z on z.id = rs.zone_id
where rs.run_at = (select max(run_at) from public.risk_scores);

grant select on public.latest_risk to anon, authenticated;
