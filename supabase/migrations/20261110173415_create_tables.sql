-- Core tables for NH-44 RouteGuard.
-- All geometry is geography(Point, 4326): WGS84 lon/lat, distances in metres.

-- Keeps updated_at current on tables whose rows change after insert.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- zones: the 6 corridor segments from Jammu to Srinagar
-- ---------------------------------------------------------------------------
create table public.zones (
  id          smallint primary key check (id between 1 and 6),
  name        text not null,
  from_place  text not null,
  to_place    text not null,
  length_km   numeric(6, 2) not null check (length_km > 0),
  danger_km   numeric(6, 2) not null default 0 check (danger_km >= 0),
  risk_level  text not null check (risk_level in ('low', 'medium', 'high', 'extreme')),
  base_risk   numeric(4, 3) not null check (base_risk between 0 and 1),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint zones_danger_within_length check (danger_km <= length_km)
);

create trigger zones_set_updated_at
  before update on public.zones
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- hexes: H3 cells along the corridor (from data/corridor_hexes.csv + hex_slope.csv)
-- ---------------------------------------------------------------------------
create table public.hexes (
  h3_index          text primary key,
  zone_id           smallint not null references public.zones (id),
  slope_deg         numeric(5, 2) check (slope_deg between 0 and 90),
  centroid          extensions.geography(Point, 4326),
  weather_point_id  text,
  created_at        timestamptz not null default now()
);

create index hexes_zone_id_idx on public.hexes (zone_id);
create index hexes_weather_point_id_idx on public.hexes (weather_point_id);
create index hexes_centroid_gix on public.hexes using gist (centroid);

-- ---------------------------------------------------------------------------
-- weather_readings: observed and forecast weather per point.
-- Unique (point_id, valid_at) lets the hourly job upsert.
-- ---------------------------------------------------------------------------
create table public.weather_readings (
  id                bigint generated always as identity primary key,
  point_id          text not null,
  location          extensions.geography(Point, 4326),
  valid_at          timestamptz not null,
  is_forecast       boolean not null default false,
  precipitation_mm  numeric(7, 2) check (precipitation_mm >= 0),
  snowfall_cm       numeric(7, 2) check (snowfall_cm >= 0),
  snow_depth_m      numeric(6, 3) check (snow_depth_m >= 0),
  temperature_c     numeric(5, 2),
  fetched_at        timestamptz not null default now(),
  constraint weather_readings_point_valid_at_key unique (point_id, valid_at)
);

create index weather_readings_valid_at_idx on public.weather_readings (valid_at desc);

-- ---------------------------------------------------------------------------
-- risk_scores: output of the hourly model, per hex or per zone (h3_index null)
-- ---------------------------------------------------------------------------
create table public.risk_scores (
  id             bigint generated always as identity primary key,
  run_at         timestamptz not null default now(),
  h3_index       text references public.hexes (h3_index) on delete cascade,
  zone_id        smallint not null references public.zones (id),
  horizon_hours  smallint not null check (horizon_hours in (0, 12, 24, 48)),
  landslide      numeric(4, 3) check (landslide between 0 and 1),
  rockfall       numeric(4, 3) check (rockfall between 0 and 1),
  flash_flood    numeric(4, 3) check (flash_flood between 0 and 1),
  snow_ice       numeric(4, 3) check (snow_ice between 0 and 1),
  overall        numeric(4, 3) not null check (overall between 0 and 1),
  top_hazard     public.hazard_type,
  risk_low       numeric(4, 3) check (risk_low between 0 and 1),
  risk_high      numeric(4, 3) check (risk_high between 0 and 1),
  confidence     public.confidence_level,
  reason         text,
  model_version  text not null,
  constraint risk_scores_range_order check (risk_low <= risk_high)
);

create index risk_scores_zone_run_at_idx on public.risk_scores (zone_id, run_at desc);
create index risk_scores_h3_run_at_idx on public.risk_scores (h3_index, run_at desc);

-- ---------------------------------------------------------------------------
-- incidents: historical closures (from data/incidents.csv)
-- CSV columns: date, zone_id, place, lat, lng, hazard_type, hours_closed,
--              trucks_stranded, source_url
-- ---------------------------------------------------------------------------
create table public.incidents (
  id               bigint generated always as identity primary key,
  date             date not null,
  zone_id          smallint not null references public.zones (id),
  place            text,
  lat              double precision check (lat between -90 and 90),
  lng              double precision check (lng between -180 and 180),
  location         extensions.geography(Point, 4326) generated always as (
                     extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography
                   ) stored,
  hazard_type      public.hazard_type not null,
  hours_closed     numeric(7, 2) check (hours_closed >= 0),
  trucks_stranded  integer check (trucks_stranded >= 0),
  source_url       text,
  created_at       timestamptz not null default now()
);

create index incidents_zone_date_idx on public.incidents (zone_id, date desc);
create index incidents_location_gix on public.incidents using gist (location);

-- ---------------------------------------------------------------------------
-- users: app profile for each Supabase Auth user
-- ---------------------------------------------------------------------------
create table public.users (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        public.user_role not null,
  name        text,
  phone       text unique,
  verified    boolean not null default false,
  agent_id    uuid references public.users (id) on delete set null, -- a driver's transport agent
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint users_agent_not_self check (agent_id is null or agent_id <> id)
);

create index users_agent_id_idx on public.users (agent_id);
create index users_role_idx on public.users (role);

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- reports: live hazard reports from drivers and police
-- ---------------------------------------------------------------------------
create table public.reports (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references public.users (id) on delete set null,
  source         public.report_source not null,
  hazard_type    public.hazard_type not null,
  location       extensions.geography(Point, 4326) not null,
  zone_id        smallint references public.zones (id),
  photo_path     text,
  note           text,
  status         public.report_status not null default 'unconfirmed',
  confirmations  integer not null default 0 check (confirmations >= 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  expires_at     timestamptz,
  constraint reports_expires_after_created check (expires_at is null or expires_at > created_at)
);

create index reports_zone_created_idx on public.reports (zone_id, created_at desc);
create index reports_status_expires_idx on public.reports (status, expires_at);
create index reports_user_id_idx on public.reports (user_id);
create index reports_location_gix on public.reports using gist (location);

create trigger reports_set_updated_at
  before update on public.reports
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- shipments: apple trucks being tracked and advised
-- ---------------------------------------------------------------------------
create table public.shipments (
  id             uuid primary key default gen_random_uuid(),
  agent_id       uuid references public.users (id) on delete set null,
  driver_id      uuid references public.users (id) on delete set null,
  truck_number   text,
  variety        text,
  tonnes         numeric(6, 2) check (tonnes > 0),
  harvest_date   date,
  cold_stored    boolean not null default false,
  truck_type     public.truck_type,
  origin         text,
  destination    text,
  status         public.shipment_status not null default 'planned',
  advice         text,
  last_location  extensions.geography(Point, 4326),
  last_seen_at   timestamptz,
  eta            timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index shipments_agent_id_idx on public.shipments (agent_id);
create index shipments_driver_id_idx on public.shipments (driver_id);
create index shipments_status_idx on public.shipments (status);
create index shipments_last_location_gix on public.shipments using gist (last_location);

create trigger shipments_set_updated_at
  before update on public.shipments
  for each row execute function public.set_updated_at();
