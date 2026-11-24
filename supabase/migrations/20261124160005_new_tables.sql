-- New tables for Round 3 (BUILD_PROMPT section 7). RLS and access rules come
-- in a later migration (rls_policies); until then nobody but the owner can
-- read or write them.

-- ---------------------------------------------------------------------------
-- verifications: how a person got their verification level. Nothing else is
-- stored: for Aadhaar only the last 4 digits, never the number or the QR.
-- ---------------------------------------------------------------------------
create table public.verifications (
  id               bigint generated always as identity primary key,
  user_id          text not null references public.users (id) on delete cascade,
  method           public.verification_method not null,
  verdict          public.verification_verdict not null,
  last4            text check (last4 ~ '^[0-9]{4}$'),
  verified_by      text references public.users (id) on delete set null,
  consent_version  text check (char_length(consent_version) <= 20),
  cert_version     text check (char_length(cert_version) <= 40),
  created_at       timestamptz not null default now(),
  constraint verifications_last4_only_aadhaar check (last4 is null or method = 'aadhaar_qr')
);

create index verifications_user_id_idx on public.verifications (user_id);

-- ---------------------------------------------------------------------------
-- report_confirmations: one per person per report.
-- report_flags: one per person per report, with a reason.
-- ---------------------------------------------------------------------------
create table public.report_confirmations (
  report_id   uuid not null references public.reports (id) on delete cascade,
  user_id     text not null references public.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (report_id, user_id)
);

create index report_confirmations_user_id_idx on public.report_confirmations (user_id);

create table public.report_flags (
  id          bigint generated always as identity primary key,
  report_id   uuid not null references public.reports (id) on delete cascade,
  user_id     text not null references public.users (id) on delete cascade,
  reason      public.flag_reason not null,
  created_at  timestamptz not null default now(),
  constraint report_flags_once_per_user unique (report_id, user_id)
);

create index report_flags_user_id_idx on public.report_flags (user_id);

-- ---------------------------------------------------------------------------
-- official_updates: what a public J&K Traffic Police / TCU advisory said,
-- typed in by an admin or the demo police account, always with its source.
-- Edits make a new version (supersedes_id); deletes are soft, with a reason.
-- ---------------------------------------------------------------------------
create table public.official_updates (
  id             uuid primary key default gen_random_uuid(),
  zone_id        smallint references public.zones (id),   -- null = whole corridor
  kind           public.official_update_kind not null,
  title          text not null check (char_length(title) between 1 and 120),
  body           text check (char_length(body) <= 1000),
  source_url     text not null check (source_url like 'https://%'),
  source_name    text not null check (char_length(source_name) between 1 and 120),
  issued_at      timestamptz not null,
  valid_until    timestamptz not null,
  version        integer not null default 1 check (version >= 1),
  supersedes_id  uuid references public.official_updates (id),
  created_by     text not null references public.users (id),
  created_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  delete_reason  text check (char_length(delete_reason) <= 280),
  constraint official_updates_valid_after_issued check (valid_until > issued_at),
  constraint official_updates_delete_needs_reason check (deleted_at is null or delete_reason is not null)
);

create index official_updates_zone_valid_idx on public.official_updates (zone_id, valid_until desc);

-- ---------------------------------------------------------------------------
-- road_status: Mughal Road (the alternative route) and the rail parcel
-- service. Both start as "unknown": we don't claim either is open until an
-- admin enters it with a source.
-- ---------------------------------------------------------------------------
create table public.road_status (
  item        text primary key check (item in ('mughal_road', 'rail_parcel')),
  state       public.road_state not null default 'unknown',
  source_url  text check (source_url like 'https://%'),
  updated_by  text references public.users (id) on delete set null,
  updated_at  timestamptz not null default now()
);

create trigger road_status_set_updated_at
  before update on public.road_status
  for each row execute function public.set_updated_at();

insert into public.road_status (item) values ('mughal_road'), ('rail_parcel');

-- ---------------------------------------------------------------------------
-- audit_log: who did what privileged thing, when and why. Append-only: rows
-- are added through public.write_audit() and can never be changed or deleted
-- (enforced in the rls_policies migration). No personal data in meta.
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id           bigserial primary key,
  at           timestamptz not null default now(),
  actor_id     text,
  actor_role   text,
  action       text not null check (char_length(action) <= 60),
  target_type  text check (char_length(target_type) <= 40),
  target_id    text check (char_length(target_id) <= 80),
  reason       text check (char_length(reason) <= 500),
  request_id   text check (char_length(request_id) <= 64),
  meta         jsonb check (jsonb_typeof(meta) = 'object')
);

create index audit_log_at_idx on public.audit_log (at desc);

-- ---------------------------------------------------------------------------
-- idempotency_keys: the first answer to a POST with an Idempotency-Key header,
-- so a retried request gets the same answer instead of a duplicate. Rows older
-- than 24 h are deleted by a scheduled job (section 17).
-- ---------------------------------------------------------------------------
create table public.idempotency_keys (
  user_id          text not null references public.users (id) on delete cascade,
  route            text not null check (char_length(route) <= 120),
  key              text not null check (char_length(key) between 8 and 100),
  response_status  smallint not null,
  response_body    jsonb,
  created_at       timestamptz not null default now(),
  primary key (user_id, route, key)
);

create index idempotency_keys_created_at_idx on public.idempotency_keys (created_at);
