-- Shared rate limits (BUILD_PROMPT sections 10 and 17, work package C3).
--
-- Every app instance counts in the same table, so a limit holds however many
-- replicas run. Fixed windows: one row per bucket per window, bumped with an
-- upsert, so two requests at the same moment can't both slip through.
--
-- Buckets look like "advice:ip:<hmac>" or "role:user:<clerk id>". IPs are
-- never stored: the app sends a keyed hash. Rows are deleted a day after
-- their window ends (pg_cron below).
--
-- Everything lives in the private schema, which Supabase's REST API doesn't
-- expose, so a visitor with the publishable key can't call the function to
-- fill someone else's bucket. The app's database login reaches it as anon or
-- authenticated (docs/security.md).

create table private.rate_limits (
  bucket        text        not null check (char_length(bucket) between 1 and 200),
  window_start  timestamptz not null,
  hits          integer     not null default 1 check (hits >= 1),
  primary key (bucket, window_start)
);

alter table private.rate_limits enable row level security;
revoke all on private.rate_limits from public, anon, authenticated;

-- One hit on a bucket. Returns whether it is allowed, the count in this
-- window, and how many seconds until the window resets (0 when allowed).
create or replace function private.rate_limit_hit(
  p_bucket          text,
  p_limit           integer,
  p_window_seconds  integer
)
returns table (allowed boolean, hits integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz;
  v_count integer;
begin
  if p_bucket is null or char_length(p_bucket) not between 1 and 200
     or p_limit is null or p_limit < 1
     or p_window_seconds is null or p_window_seconds not between 1 and 86400 then
    raise exception 'rate_limit_hit: bad arguments' using errcode = '22023';
  end if;

  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into private.rate_limits as r (bucket, window_start, hits)
  values (p_bucket, v_window, 1)
  on conflict on constraint rate_limits_pkey do update set hits = r.hits + 1
  returning r.hits into v_count;

  return query select
    v_count <= p_limit,
    v_count,
    case when v_count <= p_limit then 0
         else greatest(1, ceil(extract(epoch from (v_window + make_interval(secs => p_window_seconds) - now())))::integer)
    end;
end;
$$;

revoke all on function private.rate_limit_hit(text, integer, integer) from public;
grant execute on function private.rate_limit_hit(text, integer, integer) to anon, authenticated;

-- Old windows go once a day has passed. The longest window is an hour.
create or replace function private.rate_limits_cleanup()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from private.rate_limits where window_start < now() - interval '1 day';
$$;

revoke all on function private.rate_limits_cleanup() from public, anon, authenticated;

select cron.schedule('rate-limits-cleanup', '23 * * * *', 'select private.rate_limits_cleanup()');
