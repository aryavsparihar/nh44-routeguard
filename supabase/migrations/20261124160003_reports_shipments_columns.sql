-- reports and shipments: Round 3 columns and the same limits as the zod
-- schemas, so the database refuses bad rows even if a route forgets a check.
-- Both tables were empty when this was written (24 Nov 2026).

-- ---------------------------------------------------------------------------
-- reports
-- ---------------------------------------------------------------------------
alter table public.reports
  -- The phone's own id for the report: a retry after a dropped connection
  -- can't create the same report twice.
  add column client_id uuid unique,
  add column hidden_reason text check (char_length(hidden_reason) <= 280),
  add column is_demo boolean not null default false,
  -- Every report expires (section 9), so the map never shows stale hazards.
  alter column expires_at set not null,
  add constraint reports_note_length check (char_length(note) <= 280),
  -- ::text so this works even in the same push that added the 'hidden' value.
  add constraint reports_hidden_needs_reason check (status::text <> 'hidden' or hidden_reason is not null);

-- The map asks "active reports in this zone".
create index reports_zone_status_expires_idx on public.reports (zone_id, status, expires_at);

-- ---------------------------------------------------------------------------
-- shipments
-- ---------------------------------------------------------------------------
alter table public.shipments
  -- The advice at the time the lot was saved: decision, reason_code,
  -- rules_version, risk_run_at (section 7).
  alter column advice type jsonb using null::jsonb,
  add constraint shipments_advice_is_object check (jsonb_typeof(advice) = 'object'),
  -- Who created it (a grower or trader), so they can see it later.
  add column created_by text references public.users (id) on delete set null,
  add column is_demo boolean not null default false,
  -- Same range as the app (section 6).
  add constraint shipments_tonnes_range check (tonnes between 0.1 and 40),
  -- Same formats as truckNumber in src/server/schemas/common.ts.
  add constraint shipments_truck_number_format check (
    truck_number ~ '^([A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}|[0-9]{2}BH[0-9]{4}[A-Z]{1,2})$'
  );

-- RLS looks rows up by these (agent_id and driver_id are already indexed).
create index shipments_created_by_idx on public.shipments (created_by);
