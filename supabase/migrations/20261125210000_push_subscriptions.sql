-- Web Push alerts (BUILD_PROMPT WP-B B6, P1).
--
--   push_subscriptions       one row per browser that said yes, with the zones
--                            it follows and its language. Deleted with the
--                            account (foreign key, on delete cascade).
--   private.push_sent        events already pushed, so a job that runs twice
--                            (jobs.schemas.ts) doesn't alert twice
--   save_push_subscription   the only way to add or change a row
--   push_report / push_update / push_targets / mark_push_sent /
--   drop_push_subscription   for the queue worker (routeguard_worker) only
--
-- The endpoint is a URL at the browser's push service. The API only accepts
-- the known push services' hosts (src/server/push/push.schemas.ts), because
-- the worker sends requests to it.

create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null references public.users (id) on delete cascade,
  endpoint    text not null unique check (char_length(endpoint) between 20 and 1000 and endpoint like 'https://%'),
  keys        jsonb not null check (
                jsonb_typeof(keys) = 'object'
                and jsonb_typeof(keys -> 'p256dh') = 'string'
                and jsonb_typeof(keys -> 'auth') = 'string'
                and pg_column_size(keys) <= 512
              ),
  zones       smallint[] not null check (cardinality(zones) between 1 and 20),
  language    text not null default 'en' check (language in ('en', 'hi', 'ur')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);
create index push_subscriptions_zones_idx on public.push_subscriptions using gin (zones);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon;
revoke insert, update, truncate on public.push_subscriptions from authenticated;

create policy "Users read their own push subscriptions" on public.push_subscriptions
  for select to authenticated
  using (user_id = (select private.jwt_sub()));

create policy "Users delete their own push subscriptions" on public.push_subscriptions
  for delete to authenticated
  using (user_id = (select private.jwt_sub()));

create table private.push_sent (
  event_key text primary key check (char_length(event_key) <= 100),
  sent_at   timestamptz not null default now()
);
revoke all on private.push_sent from public, anon, authenticated;

-- ===========================================================================
-- For signed-in users (through the API)
-- ===========================================================================

-- Adds this browser, or updates it (same endpoint: new keys, zones or
-- language; a different person signing in on the same browser takes it
-- over). At most 10 browsers per person.
create or replace function private.save_push_subscription(
  p_endpoint text,
  p_keys jsonb,
  p_zones smallint[],
  p_language text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub   text := private.jwt_sub();
  v_zones smallint[];
  v_id    uuid;
begin
  if v_sub is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if not exists (select 1 from public.users u where u.id = v_sub) then
    raise exception 'pick a role first' using errcode = '42501';
  end if;
  select array_agg(distinct z order by z) into v_zones from unnest(p_zones) z;
  if v_zones is null or exists (
    select 1 from unnest(v_zones) z where not exists (select 1 from public.zones pz where pz.id = z)
  ) then
    raise exception 'unknown zone' using errcode = '22023';
  end if;
  if (select count(*) from public.push_subscriptions s where s.user_id = v_sub and s.endpoint <> p_endpoint) >= 10 then
    raise exception 'too many devices' using errcode = '23P01';
  end if;
  insert into public.push_subscriptions as s (user_id, endpoint, keys, zones, language)
  values (v_sub, p_endpoint, p_keys, v_zones, p_language)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, keys = excluded.keys, zones = excluded.zones,
        language = excluded.language, updated_at = now()
  returning s.id into v_id;
  return v_id;
end;
$$;

revoke all on function private.save_push_subscription(text, jsonb, smallint[], text) from public, anon;
grant execute on function private.save_push_subscription(text, jsonb, smallint[], text) to authenticated;

-- ===========================================================================
-- For the queue worker
-- ===========================================================================

-- A report worth an alert: confirmed and still on the map.
create or replace function private.push_report(p_report_id uuid)
returns table (zone_id smallint, hazard_type text)
language sql
stable
security definer
set search_path = ''
as $$
  select r.zone_id, r.hazard_type::text
  from public.reports r
  where r.id = p_report_id and r.status = 'confirmed' and r.expires_at > now();
$$;

-- An official update worth an alert: not deleted and still in force.
create or replace function private.push_update(p_update_id uuid)
returns table (zone_id smallint, kind text, title text, source_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.zone_id, u.kind::text, u.title, u.source_name
  from public.official_updates u
  where u.id = p_update_id and u.deleted_at is null and u.valid_until > now();
$$;

-- Who to tell: browsers following the zone (every browser when the zone is
-- null, a whole-road update). Nobody when the event was already pushed.
create or replace function private.push_targets(p_event_key text, p_zone smallint)
returns table (endpoint text, keys jsonb, language text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.endpoint, s.keys, s.language
  from public.push_subscriptions s
  where not exists (select 1 from private.push_sent p where p.event_key = p_event_key)
    and (p_zone is null or p_zone = any (s.zones))
  order by s.created_at
  limit 5000;
$$;

create or replace function private.mark_push_sent(p_event_key text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from private.push_sent p where p.sent_at < now() - interval '30 days';
  insert into private.push_sent (event_key) values (p_event_key) on conflict do nothing;
$$;

-- The push service said this browser is gone (404 or 410).
create or replace function private.drop_push_subscription(p_endpoint text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_subscriptions s where s.endpoint = p_endpoint;
$$;

revoke all on function private.push_report(uuid) from public, anon, authenticated;
revoke all on function private.push_update(uuid) from public, anon, authenticated;
revoke all on function private.push_targets(text, smallint) from public, anon, authenticated;
revoke all on function private.mark_push_sent(text) from public, anon, authenticated;
revoke all on function private.drop_push_subscription(text) from public, anon, authenticated;

grant execute on function private.push_report(uuid) to routeguard_worker;
grant execute on function private.push_update(uuid) to routeguard_worker;
grant execute on function private.push_targets(text, smallint) to routeguard_worker;
grant execute on function private.mark_push_sent(text) to routeguard_worker;
grant execute on function private.drop_push_subscription(text) to routeguard_worker;
