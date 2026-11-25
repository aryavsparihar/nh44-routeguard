-- The job queue (BUILD_PROMPT section 17, part 2; WP-B B4).
--
--   pgmq queue "jobs"        messages { job, payload }, made by the API after
--                            a write (private.enqueue_job)
--   routeguard_worker        a database role for the worker endpoint
--                            (POST /api/v1/internal/jobs/run); it can only
--                            read, finish and fail jobs
--   job_dead_letters         jobs that failed 5 times; admins read them
--   jobs-worker (pg_cron)    every minute, calls the worker through pg_net,
--                            but only when a job is waiting, so a container
--                            that scaled to zero isn't woken for nothing
--
-- The worker's address and secret live in Supabase Vault (names
-- jobs_worker_url and jobs_secret), set by hand after the deploy
-- (docs/runbook.md). Until then the cron job does nothing.

create extension if not exists pgmq;
select pgmq.create('jobs');

-- Nobody reaches the queue tables directly; only the functions below.
revoke all on pgmq.q_jobs, pgmq.a_jobs from public, anon, authenticated;

-- ===========================================================================
-- The worker's role
-- ===========================================================================
create role routeguard_worker nologin noinherit nobypassrls;
grant routeguard_worker to routeguard_app with inherit false, set true;
-- So the database owner can act as the worker in tests (supabase/tests).
grant routeguard_worker to postgres with inherit false, set true;
grant usage on schema private to routeguard_worker;
comment on role routeguard_worker is
  'RouteGuard queue worker. The app switches to it only in POST /api/v1/internal/jobs/run (JOBS_SECRET). Runs private job functions only.';

-- ===========================================================================
-- Dead letters
-- ===========================================================================
create table public.job_dead_letters (
  id          bigint generated always as identity primary key,
  msg_id      bigint not null,
  job         text not null check (char_length(job) <= 60),
  payload     jsonb not null,
  attempts    integer not null,
  last_error  text check (char_length(last_error) <= 500),
  enqueued_at timestamptz not null,
  failed_at   timestamptz not null default now()
);

create index job_dead_letters_failed_at_idx on public.job_dead_letters (failed_at desc);

alter table public.job_dead_letters enable row level security;
revoke all on public.job_dead_letters from anon;
revoke insert, update, delete on public.job_dead_letters from authenticated;

create policy "Admins read dead letters" on public.job_dead_letters
  for select to authenticated
  using ((select private.jwt_role()) = 'admin');

-- ===========================================================================
-- Functions
-- ===========================================================================

-- The API adds a job after a write. Only known job names, small payloads.
create or replace function private.enqueue_job(p_job text, p_payload jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  if p_job is null or p_job not in ('report.created', 'report.confirmed', 'official_update.created') then
    raise exception 'unknown job' using errcode = '22023';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or pg_column_size(p_payload) > 2048 then
    raise exception 'bad job payload' using errcode = '22023';
  end if;
  select s into v_id from pgmq.send('jobs', jsonb_build_object('job', p_job, 'payload', p_payload)) as s;
  return v_id;
end;
$$;

-- Moves a message to the dead letters (inside the caller's transaction).
create or replace function private.bury_job(p_msg_id bigint, p_error text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
begin
  select q.msg_id, q.read_ct, q.enqueued_at, q.message into v_row from pgmq.q_jobs q where q.msg_id = p_msg_id;
  if not found then
    return;
  end if;
  insert into public.job_dead_letters (msg_id, job, payload, attempts, last_error, enqueued_at)
  values (
    v_row.msg_id,
    left(coalesce(v_row.message ->> 'job', 'unknown'), 60),
    coalesce(v_row.message -> 'payload', '{}'::jsonb),
    v_row.read_ct,
    left(p_error, 500),
    v_row.enqueued_at
  );
  perform pgmq.delete('jobs', p_msg_id);
end;
$$;

-- Up to p_qty jobs, hidden from other readers for p_vt seconds. A job read
-- more than 5 times (a worker that died before saying how it went) goes to
-- the dead letters instead of being handed out again.
create or replace function private.read_jobs(p_qty integer default 10, p_vt integer default 60)
returns table (msg_id bigint, read_ct integer, enqueued_at timestamptz, job text, payload jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
begin
  for v_row in
    select r.msg_id, r.read_ct, r.enqueued_at, r.message
    from pgmq.read('jobs', greatest(10, least(p_vt, 600)), greatest(1, least(p_qty, 50))) r
  loop
    if v_row.read_ct > 5 then
      perform private.bury_job(v_row.msg_id, 'read more than 5 times without finishing');
    else
      msg_id := v_row.msg_id;
      read_ct := v_row.read_ct;
      enqueued_at := v_row.enqueued_at;
      job := v_row.message ->> 'job';
      payload := coalesce(v_row.message -> 'payload', '{}'::jsonb);
      return next;
    end if;
  end loop;
end;
$$;

-- The job is done: remove it.
create or replace function private.ack_job(p_msg_id bigint)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select pgmq.delete('jobs', p_msg_id);
$$;

-- The job failed. Try again later (30 s, 60 s, ... after each try), or after
-- 5 tries move it to the dead letters. Returns 'retry' or 'dead'.
create or replace function private.fail_job(p_msg_id bigint, p_error text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reads integer;
begin
  select q.read_ct into v_reads from pgmq.q_jobs q where q.msg_id = p_msg_id;
  if not found then
    return 'gone';
  end if;
  if v_reads >= 5 then
    perform private.bury_job(p_msg_id, p_error);
    return 'dead';
  end if;
  perform pgmq.set_vt('jobs', p_msg_id, 30 * v_reads);
  return 'retry';
end;
$$;

-- pg_cron, every minute: wake the worker only when a job is due, and only
-- once Vault has its address and secret.
create or replace function private.wake_job_worker()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url    text;
  v_secret text;
begin
  if not exists (select 1 from pgmq.q_jobs q where q.vt <= now()) then
    return;
  end if;
  select s.decrypted_secret into v_url from vault.decrypted_secrets s where s.name = 'jobs_worker_url';
  select s.decrypted_secret into v_secret from vault.decrypted_secrets s where s.name = 'jobs_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := v_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'X-Jobs-Secret', v_secret),
    timeout_milliseconds := 30000
  );
end;
$$;

revoke all on function private.enqueue_job(text, jsonb) from public, anon;
revoke all on function private.bury_job(bigint, text) from public, anon, authenticated;
revoke all on function private.read_jobs(integer, integer) from public, anon, authenticated;
revoke all on function private.ack_job(bigint) from public, anon, authenticated;
revoke all on function private.fail_job(bigint, text) from public, anon, authenticated;
revoke all on function private.wake_job_worker() from public, anon, authenticated;

grant execute on function private.enqueue_job(text, jsonb) to authenticated, routeguard_worker;
grant execute on function private.read_jobs(integer, integer) to routeguard_worker;
grant execute on function private.ack_job(bigint) to routeguard_worker;
grant execute on function private.fail_job(bigint, text) to routeguard_worker;

select cron.schedule('jobs-worker', '* * * * *', 'select private.wake_job_worker()');
