-- Start the hourly risk job on time (A6).
--
-- GitHub Actions' own schedule ("7 * * * *" in risk-job.yml) skipped most
-- hours in November 2026: the job ran every 6 to 12 hours. Runs started
-- through GitHub's "run workflow" API begin right away. So pg_cron calls that
-- API at :07 and :37 every hour, through pg_net.
--
-- Every call asks the job to skip if the last run is under 40 minutes old:
--   :07  the last run is about an hour old, so it runs.
--   :37  it skips, unless the :07 run failed; then this is the retry.
--
-- The GitHub token lives in Supabase Vault as 'github_risk_dispatch_token'
-- (a fine-grained token for this repository only, permission "Actions: read
-- and write"). It is added by hand in the dashboard and never appears in the
-- repo. Without it the function only logs a warning.
-- docs/runbook.md, "Risk job timing".

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

create or replace function private.dispatch_risk_job()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  token text;
begin
  select decrypted_secret into token
  from vault.decrypted_secrets
  where name = 'github_risk_dispatch_token';

  if token is null or token = '' then
    raise warning 'risk job: no github_risk_dispatch_token in Vault, nothing started';
    return null;
  end if;

  -- Returns the pg_net request id. The answer (204 when GitHub accepted it)
  -- shows up in net._http_response for a few hours.
  return net.http_post(
    url := 'https://api.github.com/repos/aryavsparihar/nh44-routeguard/actions/workflows/risk-job.yml/dispatches',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || token,
      'Accept', 'application/vnd.github+json',
      'X-GitHub-Api-Version', '2022-11-28',
      'User-Agent', 'routeguard-risk-scheduler',
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('ref', 'main', 'inputs', jsonb_build_object('skip_if_fresh_min', '40')),
    timeout_milliseconds := 10000
  );
end;
$$;

comment on function private.dispatch_risk_job() is
  'Asks GitHub to start risk-job.yml on main (skip if the last run is under 40 min old). Called by pg_cron.';

-- Only the database owner (and pg_cron, which runs as the owner) may call it.
revoke all on function private.dispatch_risk_job() from public, anon, authenticated;

-- cron.schedule replaces a job with the same name, so this is safe to re-run.
select cron.schedule('risk-job-dispatch', '7,37 * * * *', 'select private.dispatch_risk_job()');
