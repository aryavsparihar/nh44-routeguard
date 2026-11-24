-- B1: incidents.csv rebuilt with the section 14 columns (BUILD_PROMPT section 14).
--
-- * external_id holds the CSV id (inc-YYYY-MM-DD-z<zone>-<hazard>) so seed.js
--   can upsert: rerunning the seed updates rows instead of adding copies.
-- * The CSV's event_start_date is loaded into the existing "date" column.
-- * date_basis gains inferred_relative ("last evening", "yesterday").
-- * coord_basis is limited to the values the validator knows.
-- * One row per (date, zone, hazard) for seeded rows.

alter table public.incidents
  add column external_id text
    constraint incidents_external_id_format check (external_id ~ '^inc-\d{4}-\d{2}-\d{2}-z[1-6]-[a-z_]+$');

alter table public.incidents
  add constraint incidents_external_id_key unique (external_id);

alter table public.incidents
  drop constraint if exists incidents_date_basis_check,
  add constraint incidents_date_basis_check
    check (date_basis in ('stated', 'inferred_weekday', 'inferred_relative', 'article_date'));

alter table public.incidents
  add constraint incidents_coord_basis_values
    check (coord_basis in ('osm_place', 'osm_feature', 'osm_place_nearby', 'osm_feature_old_road'));

create unique index incidents_seeded_date_zone_hazard_key
  on public.incidents (date, zone_id, hazard_type)
  where external_id is not null;

comment on column public.incidents.external_id is
  'The id from data/incidents.csv (inc-YYYY-MM-DD-z<zone>-<hazard>). Null for rows not loaded from the CSV.';
