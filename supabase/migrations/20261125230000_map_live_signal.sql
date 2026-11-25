-- Live map (BUILD_PROMPT WP-D D4b, P1): new road reports and official
-- updates show up on open maps without a reload.
--
-- After any write to reports or official_updates, one Realtime broadcast
-- "changed" goes to the public topic "map". It carries no data at all: the
-- map then loads GET /api/v1/reports and /api/v1/official-updates again, so
-- the API (and its rules about what is public) stays the only source of
-- rows, the same way the agent board uses Realtime (docs/decisions.md).
--
-- One signal per statement, not per row. If Realtime fails, the write still
-- succeeds: the signal is a hint, and open maps also reload every minute.

create or replace function private.signal_map_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform realtime.send('{}'::jsonb, 'changed', 'map', false);
  exception when others then
    null; -- never fail a report or an update because of the live signal
  end;
  return null;
end;
$$;

revoke all on function private.signal_map_changed() from public, anon, authenticated;

create trigger reports_map_signal
  after insert or update or delete on public.reports
  for each statement execute function private.signal_map_changed();

create trigger official_updates_map_signal
  after insert or update or delete on public.official_updates
  for each statement execute function private.signal_map_changed();
