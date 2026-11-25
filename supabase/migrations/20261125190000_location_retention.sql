-- Keeping a driver's position only as long as the privacy notice says (/privacy):
--   * turning location sharing off clears the last position on all of that
--     driver's shipments at once;
--   * a delivered shipment's last position is cleared 7 days after delivery
--     (a daily pg_cron job).

-- ===========================================================================
-- Sharing turned off → forget the position now
-- ===========================================================================
-- The driver can't update shipments.last_location themselves (no grant), so
-- this runs with the owner's rights, only for the driver whose row changed.
create or replace function private.users_clear_location()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.location_consent and not new.location_consent then
    update public.shipments s
    set last_location = null, last_seen_at = null
    where s.driver_id = new.id and s.last_location is not null;
  end if;
  return new;
end;
$$;

revoke all on function private.users_clear_location() from public, anon, authenticated;

create trigger users_clear_location
  after update of location_consent on public.users
  for each row execute function private.users_clear_location();

-- ===========================================================================
-- 7 days after delivery → forget the position
-- ===========================================================================
-- p_age is a parameter so the tests can run it with 0; the job uses 7 days.
-- updated_at is set when the status becomes delivered, and nothing else
-- changes a delivered shipment except this cleanup.
create or replace function private.clear_old_locations(p_age interval default interval '7 days')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.shipments s
  set last_location = null
  where s.status = 'delivered'
    and s.last_location is not null
    and s.updated_at <= now() - p_age;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function private.clear_old_locations(interval) from public, anon, authenticated;

select cron.schedule('shipment-location-cleanup', '41 3 * * *', 'select private.clear_old_locations()');
