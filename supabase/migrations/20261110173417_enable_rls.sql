-- Row Level Security on every table. With RLS on and no policy, the public
-- (publishable / anon) key can read and write nothing.
-- The Python job writes with the secret key, which bypasses RLS.

alter table public.zones            enable row level security;
alter table public.hexes            enable row level security;
alter table public.weather_readings enable row level security;
alter table public.risk_scores      enable row level security;
alter table public.incidents        enable row level security;
alter table public.users            enable row level security;
alter table public.reports          enable row level security;
alter table public.shipments        enable row level security;

-- Public read access for the map and risk data only.
grant select on public.zones, public.hexes, public.risk_scores, public.incidents
  to anon, authenticated;

create policy "Public read zones" on public.zones
  for select to anon, authenticated using (true);

create policy "Public read hexes" on public.hexes
  for select to anon, authenticated using (true);

create policy "Public read risk_scores" on public.risk_scores
  for select to anon, authenticated using (true);

create policy "Public read incidents" on public.incidents
  for select to anon, authenticated using (true);

-- TODO(Phase 1): full access rules for users, reports, shipments and
-- weather_readings (e.g. drivers insert their own reports, agents see their
-- own shipments, police confirm reports, admins manage everything).
