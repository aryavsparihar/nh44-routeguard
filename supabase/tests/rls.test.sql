-- RLS tests (pgTAP). Run with:  npm run db:test   (no Docker needed; see scripts/db/rls-test.sh)
--
-- Everything happens inside one transaction that ends in ROLLBACK, so the
-- test users, reports and shipments below never stay in the database.
--
-- To act as someone, the test switches to the role the API uses
-- (anon or authenticated) and sets the token claims Supabase would set from
-- a Clerk session token:
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub": "user_...", "metadata": {"role": "driver"}}';
-- "set local role postgres" switches back to the owner to set up or check rows.

begin;

select plan(170);

-- ===========================================================================
-- Fixtures (as the owner, so RLS doesn't apply)
-- ===========================================================================
set local role postgres;

insert into public.users (id, role, display_name, agent_id) values
  ('user_testagent',   'agent',  'Test agent',    null),
  ('user_testagent2',  'agent',  'Test agent 2',  null),
  ('user_testdriver',  'driver', 'Test driver',   'user_testagent'),
  ('user_testdriver2', 'driver', 'Test driver 2', 'user_testagent2'),
  ('user_testgrower',  'grower', 'Test grower',   null),
  ('user_testpolice',  'police', 'Test police',   null),
  ('user_testadmin',   'admin',  'Test admin',    null);

-- R1: a driver's report. R2: a hidden report. R3 is added by the driver below.
insert into public.reports (id, user_id, source, hazard_type, location, zone_id, note, status, hidden_reason, expires_at) values
  ('00000000-0000-4000-8000-000000000001', 'user_testdriver', 'driver', 'rockfall',
   extensions.st_setsrid(extensions.st_makepoint(75.10, 33.20), 4326)::extensions.geography,
   1, 'Stones on the road', 'unconfirmed', null, now() + interval '6 hours'),
  ('00000000-0000-4000-8000-000000000002', 'user_testdriver2', 'driver', 'other',
   extensions.st_setsrid(extensions.st_makepoint(75.10, 33.20), 4326)::extensions.geography,
   1, 'Hidden one', 'hidden', 'pgTAP test', now() + interval '6 hours');

-- S1 belongs to agent 1 (driver 1, created by the grower). S2 belongs to agent 2.
insert into public.shipments (id, agent_id, driver_id, created_by, tonnes) values
  ('00000000-0000-4000-8000-0000000000a1', 'user_testagent',  'user_testdriver', 'user_testgrower', 10),
  ('00000000-0000-4000-8000-0000000000a2', 'user_testagent2', 'user_testdriver2', null, 12);

-- O1 live, O2 soft-deleted.
insert into public.official_updates (id, zone_id, kind, title, source_url, source_name, issued_at, valid_until, created_by, deleted_at, delete_reason) values
  ('00000000-0000-4000-8000-0000000000b1', 1, 'advisory', 'Live test update',
   'https://example.com/live', 'pgTAP', now(), now() + interval '1 day', 'user_testpolice', null, null),
  ('00000000-0000-4000-8000-0000000000b2', 1, 'closure', 'Deleted test update',
   'https://example.com/deleted', 'pgTAP', now(), now() + interval '1 day', 'user_testpolice', now(), 'pgTAP test');

-- One verified incident (two different people) next to the unverified ones.
insert into public.incidents (date, zone_id, hazard_type, source_url, added_by, verified_by, verified_on, is_demo) values
  (current_date, 1, 'landslide', 'https://example.com/rls-test', 'tester-a', 'tester-b', current_date, true);

-- ===========================================================================
-- Every table in public has RLS on
-- ===========================================================================
select is_empty(
  $$ select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity $$,
  'every table in public has RLS on'
);

-- ===========================================================================
-- Signed out (anon)
-- ===========================================================================
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select throws_ok($$ select * from public.reports $$, '42501', null::text,
  'anon: cannot read the reports table');
select throws_ok($$ select * from public.users $$, '42501', null::text,
  'anon: cannot read users');
select throws_ok($$ select * from public.shipments $$, '42501', null::text,
  'anon: cannot read shipments');

select hasnt_column('public', 'public_reports', 'user_id', 'public_reports has no user_id');
select hasnt_column('public', 'public_reports', 'photo_path', 'public_reports has no photo_path');
select is((select count(*) from public.public_reports where id = '00000000-0000-4000-8000-000000000001'),
  1::bigint, 'anon: sees a normal report through public_reports');
select is((select count(*) from public.public_reports where id = '00000000-0000-4000-8000-000000000002'),
  0::bigint, 'anon: does not see a hidden report');
select throws_ok(
  $$ insert into public.public_reports (source, hazard_type, location, expires_at)
     values ('driver', 'other', extensions.st_setsrid(extensions.st_makepoint(75.1, 33.2), 4326)::extensions.geography, now() + interval '1 hour') $$,
  '42501', null::text, 'anon: cannot write through public_reports');

select is((select count(*) from public.official_updates where id = '00000000-0000-4000-8000-0000000000b1'),
  1::bigint, 'anon: sees a live official update');
select is((select count(*) from public.official_updates where id = '00000000-0000-4000-8000-0000000000b2'),
  0::bigint, 'anon: does not see a deleted official update');

select is((select count(*) from public.incidents where verified_by is null),
  0::bigint, 'anon: sees no unverified incidents');
select is((select count(*) from public.incidents where source_url = 'https://example.com/rls-test'),
  1::bigint, 'anon: sees a verified incident');

select is((select count(*) from public.road_status), 2::bigint, 'anon: reads road_status');

select throws_ok($$ select public.write_audit('test.anon') $$, '42501', null::text,
  'anon: cannot call write_audit');
select throws_ok($$ select public.admin_set_role('user_testdriver', 'admin', 'x') $$, '42501', null::text,
  'anon: cannot call admin_set_role');

-- ===========================================================================
-- Driver
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub": "user_testdriver", "role": "authenticated", "metadata": {"role": "driver"}}';

-- users
select is((select count(*) from public.users), 1::bigint, 'driver: sees only their own user row');
select throws_ok($$ update public.users set role = 'admin' where id = 'user_testdriver' $$,
  '42501', null::text, 'driver: cannot make themselves admin');
select throws_ok($$ update public.users set verification_level = 'official' where id = 'user_testdriver' $$,
  '42501', null::text, 'driver: cannot raise their own verification level');
select throws_ok($$ update public.users set agent_id = 'user_testagent2' where id = 'user_testdriver' $$,
  '42501', null::text, 'driver: cannot change their own agent');
select lives_ok($$ update public.users set display_name = 'Renamed driver' where id = 'user_testdriver' $$,
  'driver: can change their own display name');

-- shipments
select is((select count(*) from public.shipments where id = '00000000-0000-4000-8000-0000000000a1'),
  1::bigint, 'driver: sees the shipment they drive');
select is((select count(*) from public.shipments where id = '00000000-0000-4000-8000-0000000000a2'),
  0::bigint, 'driver: cannot see another agent''s shipment');
select throws_ok($$ insert into public.shipments (created_by, tonnes) values ('user_testdriver', 5) $$,
  '42501', null::text, 'driver: cannot create a shipment');

-- reports
select throws_ok(
  $$ insert into public.reports (user_id, source, hazard_type, location, zone_id, expires_at)
     values ('user_testdriver', 'police', 'rockfall', extensions.st_setsrid(extensions.st_makepoint(75.1, 33.2), 4326)::extensions.geography, 1, now() + interval '6 hours') $$,
  '42501', null::text, 'driver: cannot post a report as police');
select throws_ok(
  $$ insert into public.reports (user_id, source, hazard_type, location, zone_id, status, expires_at)
     values ('user_testdriver', 'driver', 'rockfall', extensions.st_setsrid(extensions.st_makepoint(75.1, 33.2), 4326)::extensions.geography, 1, 'confirmed', now() + interval '6 hours') $$,
  '42501', null::text, 'driver: cannot post a report that is already confirmed');
select throws_ok(
  $$ insert into public.reports (user_id, source, hazard_type, location, zone_id, expires_at)
     values ('user_testdriver2', 'driver', 'rockfall', extensions.st_setsrid(extensions.st_makepoint(75.1, 33.2), 4326)::extensions.geography, 1, now() + interval '6 hours') $$,
  '42501', null::text, 'driver: cannot post a report in someone else''s name');
-- A PostgREST filter string as a note is stored as plain text.
select lives_ok(
  $$ insert into public.reports (id, user_id, source, hazard_type, location, zone_id, note, expires_at)
     values ('00000000-0000-4000-8000-000000000003', 'user_testdriver', 'driver', 'rockfall',
             extensions.st_setsrid(extensions.st_makepoint(75.1, 33.2), 4326)::extensions.geography, 1, 'x),id.gt.0', now() + interval '6 hours') $$,
  'driver: can post a report as themselves');
select is((select note from public.reports where id = '00000000-0000-4000-8000-000000000003'),
  'x),id.gt.0', 'driver: an injection-style note comes back as plain text');
select is((select count(*) from public.reports where user_id <> 'user_testdriver'),
  0::bigint, 'driver: sees only their own rows in the reports table');
select lives_ok($$ update public.reports set note = 'edited' where id = '00000000-0000-4000-8000-000000000001' $$,
  'driver: an update of their report runs but changes nothing (checked below)');

-- confirmations, flags
select throws_ok(
  $$ insert into public.report_confirmations (report_id, user_id) values ('00000000-0000-4000-8000-000000000001', 'user_testdriver') $$,
  '42501', null::text, 'driver: cannot confirm their own report');
select lives_ok(
  $$ insert into public.report_confirmations (report_id, user_id) values ('00000000-0000-4000-8000-000000000002', 'user_testdriver') $$,
  'driver: can confirm someone else''s report');

-- audit_log, verifications, idempotency_keys
select throws_ok($$ insert into public.audit_log (action) values ('test.fake') $$,
  '42501', null::text, 'driver: cannot write to audit_log directly');
select is((select count(*) from public.audit_log), 0::bigint, 'driver: cannot read audit_log');
select throws_ok(
  $$ insert into public.verifications (user_id, method, verdict) values ('user_testdriver', 'admin', 'verified') $$,
  '42501', null::text, 'driver: cannot verify themselves');
select lives_ok(
  $$ insert into public.idempotency_keys (user_id, route, key, response_status) values ('user_testdriver', 'POST /api/v1/reports', 'pgtap-key-1', 201) $$,
  'driver: can save their own idempotency key');
select throws_ok(
  $$ insert into public.idempotency_keys (user_id, route, key, response_status) values ('user_testagent', 'POST /api/v1/reports', 'pgtap-key-2', 201) $$,
  '42501', null::text, 'driver: cannot save an idempotency key for someone else');

-- ===========================================================================
-- Grower
-- ===========================================================================
set local request.jwt.claims = '{"sub": "user_testgrower", "role": "authenticated", "metadata": {"role": "grower"}}';

select is((select count(*) from public.shipments where id = '00000000-0000-4000-8000-0000000000a1'),
  1::bigint, 'grower: sees the shipment they created');
select lives_ok($$ insert into public.shipments (created_by, tonnes) values ('user_testgrower', 8) $$,
  'grower: can create a shipment');
select throws_ok(
  $$ insert into public.official_updates (kind, title, source_url, source_name, issued_at, valid_until, created_by)
     values ('closure', 'Fake closure', 'https://example.com/x', 'x', now(), now() + interval '1 day', 'user_testgrower') $$,
  '42501', null::text, 'grower: cannot post an official update');
select throws_ok(
  $$ insert into public.reports (user_id, source, hazard_type, location, zone_id, expires_at)
     values ('user_testgrower', 'driver', 'rockfall', extensions.st_setsrid(extensions.st_makepoint(75.1, 33.2), 4326)::extensions.geography, 1, now() + interval '6 hours') $$,
  '42501', null::text, 'grower: cannot post a road report');
select throws_ok(
  $$ insert into public.report_confirmations (report_id, user_id) values ('00000000-0000-4000-8000-000000000001', 'user_testgrower') $$,
  '42501', null::text, 'grower: cannot confirm reports');
select lives_ok(
  $$ insert into public.report_flags (report_id, user_id, reason) values ('00000000-0000-4000-8000-000000000001', 'user_testgrower', 'not_there') $$,
  'grower: can flag a report');
select throws_ok(
  $$ insert into public.report_flags (report_id, user_id, reason) values ('00000000-0000-4000-8000-000000000001', 'user_testgrower', 'duplicate') $$,
  '23505', null::text, 'grower: cannot flag the same report twice');
select is((select count(*) from public.idempotency_keys), 0::bigint,
  'grower: cannot see another user''s idempotency keys');
select lives_ok($$ update public.road_status set state = 'open' where item = 'mughal_road' $$,
  'grower: an update of road_status runs but changes nothing (checked below)');

-- ===========================================================================
-- Agents
-- ===========================================================================
set local request.jwt.claims = '{"sub": "user_testagent", "role": "authenticated", "metadata": {"role": "agent"}}';

select is((select count(*) from public.users where id in ('user_testdriver', 'user_testdriver2')),
  1::bigint, 'agent: sees their own driver, not other drivers');
select throws_ok(
  $$ update public.shipments set agent_id = 'user_testagent2' where id = '00000000-0000-4000-8000-0000000000a1' $$,
  '42501', null::text, 'agent: cannot hand a shipment to another agent');
select lives_ok(
  $$ update public.shipments set status = 'holding' where id = '00000000-0000-4000-8000-0000000000a1' $$,
  'agent: can update their own shipment');

set local request.jwt.claims = '{"sub": "user_testagent2", "role": "authenticated", "metadata": {"role": "agent"}}';

select lives_ok(
  $$ update public.shipments set status = 'stuck' where id = '00000000-0000-4000-8000-0000000000a1' $$,
  'agent 2: an update of someone else''s shipment runs but changes nothing (checked below)');

-- ===========================================================================
-- Police
-- ===========================================================================
set local request.jwt.claims = '{"sub": "user_testpolice", "role": "authenticated", "metadata": {"role": "police"}}';

select lives_ok(
  $$ insert into public.official_updates (kind, title, source_url, source_name, issued_at, valid_until, created_by)
     values ('one_way', 'Test one-way', 'https://example.com/one-way', 'pgTAP', now(), now() + interval '1 day', 'user_testpolice') $$,
  'police: can post an official update');
select throws_ok(
  $$ insert into public.official_updates (kind, title, source_url, source_name, issued_at, valid_until, created_by)
     values ('one_way', 'Test one-way', 'https://example.com/one-way', 'pgTAP', now(), now() + interval '1 day', 'user_testadmin') $$,
  '42501', null::text, 'police: cannot post an official update in someone else''s name');
select is((select count(*) from public.official_updates where id = '00000000-0000-4000-8000-0000000000b2'),
  1::bigint, 'police: sees deleted official updates (history)');

-- An edit, as PATCH /api/v1/admin/official-updates/{id} sends it: close the
-- old version, add version 2 pointing at it, audit it. Then a soft delete.
select lives_ok(
  $$ update public.official_updates
     set deleted_at = now(), delete_reason = 'Replaced by version ' || (version + 1)
     where id = '00000000-0000-4000-8000-0000000000b1' and deleted_at is null $$,
  'police: can close the old version of an update');
select lives_ok(
  $$ insert into public.official_updates (id, zone_id, kind, title, source_url, source_name, issued_at, valid_until,
       version, supersedes_id, created_by)
     values ('00000000-0000-4000-8000-0000000000b3', 1, 'advisory', 'Live test update, edited',
       'https://example.com/live', 'pgTAP', now(), now() + interval '1 day',
       2, '00000000-0000-4000-8000-0000000000b1', 'user_testpolice') $$,
  'police: can add the new version');
select lives_ok($$ select public.write_audit('official_update.edited', 'official_update',
  '00000000-0000-4000-8000-0000000000b3', null, 'req-pgtap-ou', '{"version": 2}'::jsonb) $$,
  'police: can audit the edit');
select lives_ok(
  $$ update public.official_updates set deleted_at = now(), delete_reason = 'pgTAP delete'
     where id = '00000000-0000-4000-8000-0000000000b3' and deleted_at is null $$,
  'police: can soft delete an update with a reason');
select throws_ok(
  $$ update public.official_updates set deleted_at = now(), delete_reason = null
     where id = '00000000-0000-4000-8000-0000000000b1' $$,
  '23514', null::text, 'police: cannot delete an update without a reason');
select lives_ok($$ delete from public.official_updates where id = '00000000-0000-4000-8000-0000000000b3' $$,
  'police: a real delete runs but removes nothing (checked below)');
select lives_ok($$ update public.road_status set state = 'closed' where item = 'rail_parcel' $$,
  'police: an update of road_status runs but changes nothing (checked below)');

-- ===========================================================================
-- A new user onboarding
-- ===========================================================================
set local request.jwt.claims = '{"sub": "user_testnew", "role": "authenticated", "metadata": {}}';

select throws_ok($$ insert into public.users (id, role) values ('user_testnew', 'police') $$,
  '42501', null::text, 'new user: cannot sign up as police');
select throws_ok($$ insert into public.users (id, role) values ('user_testnew', 'admin') $$,
  '42501', null::text, 'new user: cannot sign up as admin');
select throws_ok($$ insert into public.users (id, role) values ('user_testother', 'grower') $$,
  '42501', null::text, 'new user: cannot create someone else''s row');
select throws_ok($$ insert into public.users (id, role, verification_level) values ('user_testnew', 'grower', 'official') $$,
  '42501', null::text, 'new user: cannot set their own verification level');
select lives_ok($$ insert into public.users (id, role, display_name) values ('user_testnew', 'grower', 'New grower') $$,
  'new user: can create their own row as a grower');

-- ===========================================================================
-- Admin
-- ===========================================================================
set local request.jwt.claims = '{"sub": "user_testadmin", "role": "authenticated", "metadata": {"role": "admin"}}';

select is((select count(*) from public.users where id like 'user\_test%'), 8::bigint,
  'admin: sees every user');
select lives_ok(
  $$ update public.reports set status = 'resolved' where id = '00000000-0000-4000-8000-000000000003' $$,
  'admin: can resolve a report');
select lives_ok($$ select public.write_audit('test.rls', 'report', 'pgtap', 'pgTAP check', null, '{"k": 1}'::jsonb) $$,
  'admin: can write an audit entry through write_audit');
select throws_ok($$ update public.audit_log set reason = 'changed' $$,
  '42501', null::text, 'admin: cannot change audit_log');
select throws_ok($$ delete from public.audit_log $$,
  '42501', null::text, 'admin: cannot delete from audit_log');

-- Road status, as PATCH /api/v1/admin/road-status sends it.
select lives_ok($$ select state from public.road_status where item = 'mughal_road' for update $$,
  'admin: can lock a road_status row to read the old state');
select lives_ok(
  $$ update public.road_status set state = 'open', source_url = 'https://example.com/mughal', updated_by = 'user_testadmin'
     where item = 'mughal_road' $$,
  'admin: can set Mughal Road open with a source');
select throws_ok(
  $$ update public.road_status set source_url = 'http://example.com/rail' where item = 'rail_parcel' $$,
  '23514', null::text, 'admin: road_status refuses an http:// source');

-- Role changes (admin_set_role)
select lives_ok($$ select public.admin_set_role('user_testgrower', 'police', 'Demo police account for the round', 'req-pgtap-1') $$,
  'admin: can make someone police with a reason');
select lives_ok($$ select public.admin_set_role('user_testgrower', 'grower', 'Demo over', 'req-pgtap-2') $$,
  'admin: can move someone back to grower');
select lives_ok($$ select public.admin_set_role('user_testghost', 'police', 'Demo police account', 'req-pgtap-3') $$,
  'admin: can give a role to a user who has no row yet');
select throws_ok($$ select public.admin_set_role('user_testadmin', 'grower', 'Oops') $$,
  '42501', null::text, 'admin: cannot change their own role');
select throws_ok($$ select public.admin_set_role('user_testdriver', 'agent', '   ') $$,
  '22023', null::text, 'admin: cannot change a role without a reason');

set local request.jwt.claims = '{"sub": "user_testdriver", "role": "authenticated", "metadata": {"role": "driver"}}';

select throws_ok($$ select public.admin_set_role('user_testdriver', 'admin', 'I want to be admin') $$,
  '42501', null::text, 'driver: cannot call admin_set_role');

-- ===========================================================================
-- Back to the owner: check what the updates above really did, and that
-- audit_log stays append-only even for the owner.
-- ===========================================================================
set local role postgres;

select is((select actor_id || ':' || actor_role from public.audit_log where action = 'test.rls'),
  'user_testadmin:admin', 'write_audit takes the actor from the token');
select throws_ok($$ update public.audit_log set reason = 'changed' where action = 'test.rls' $$,
  '42501', null::text, 'owner: cannot change audit_log rows');
select throws_ok($$ delete from public.audit_log where action = 'test.rls' $$,
  '42501', null::text, 'owner: cannot delete audit_log rows');
select throws_ok($$ truncate public.audit_log $$,
  '42501', null::text, 'owner: cannot truncate audit_log');

select is((select note from public.reports where id = '00000000-0000-4000-8000-000000000001'),
  'Stones on the road', 'a driver''s update did not change their report');
select is((select status::text from public.reports where id = '00000000-0000-4000-8000-000000000003'),
  'resolved', 'the admin''s update resolved the report');
select is((select status::text from public.shipments where id = '00000000-0000-4000-8000-0000000000a1'),
  'holding', 'agent 2 did not change agent 1''s shipment');
select is((select state::text || ' ' || source_url from public.road_status where item = 'mughal_road'),
  'open https://example.com/mughal', 'only the admin changed Mughal Road (the grower''s update did nothing)');
select is((select state::text from public.road_status where item = 'rail_parcel'),
  'unknown', 'police did not change road_status');
select is((select delete_reason from public.official_updates where id = '00000000-0000-4000-8000-0000000000b1'),
  'Replaced by version 2', 'the old version is closed, not removed');
select is((select version || ' ' || supersedes_id || ' ' || delete_reason from public.official_updates
           where id = '00000000-0000-4000-8000-0000000000b3'),
  '2 00000000-0000-4000-8000-0000000000b1 pgTAP delete', 'the new version points at the old one and is soft deleted');
select is((select display_name from public.users where id = 'user_testdriver'),
  'Renamed driver', 'the driver''s display name changed');

select is((select role || ':' || verification_level from public.users where id = 'user_testgrower'),
  'grower:email', 'leaving police drops the official level');
select is((select role || ':' || verification_level from public.users where id = 'user_testghost'),
  'police:official', 'a new police row is created as official');
select is(
  (select actor_id || ' | ' || actor_role || ' | ' || reason || ' | ' || request_id || ' | '
          || (meta ->> 'from') || ' > ' || (meta ->> 'to')
   from public.audit_log
   where action = 'user.role_changed' and target_id = 'user_testgrower'
   order by id limit 1),
  'user_testadmin | admin | Demo police account for the round | req-pgtap-1 | grower > police',
  'a role change is audited with actor, reason, request id and both roles');
-- Only this test's users: the real log already holds role changes (the first
-- admin, the demo driver), and those must not change the count.
select is((select count(*) from public.audit_log
           where action = 'user.role_changed' and target_id like 'user\_test%'),
  3::bigint, 'every role change wrote exactly one audit row');

-- Check constraints (the database refuses bad rows even if a route forgets).
select throws_ok($$ insert into public.shipments (tonnes) values (50) $$,
  '23514', null::text, 'shipments refuse 50 tonnes');
select throws_ok(
  $$ insert into public.reports (user_id, source, hazard_type, location, zone_id, note, expires_at)
     values ('user_testdriver', 'driver', 'rockfall', extensions.st_setsrid(extensions.st_makepoint(75.1, 33.2), 4326)::extensions.geography, 1, repeat('a', 281), now() + interval '6 hours') $$,
  '23514', null::text, 'reports refuse a 281-character note');
select throws_ok(
  $$ insert into public.official_updates (kind, title, source_url, source_name, issued_at, valid_until, created_by)
     values ('closure', 'Bad dates', 'https://example.com/x', 'x', now(), now() - interval '1 hour', 'user_testpolice') $$,
  '23514', null::text, 'official updates refuse valid_until before issued_at');

-- Incidents from incidents.csv (B1): one row per CSV id, known date and coordinate bases.
set local role postgres;
insert into public.incidents (external_id, date, zone_id, hazard_type, source_url, added_by, date_basis, coord_basis)
  values ('inc-1999-01-01-z4-landslide', '1999-01-01', 4, 'landslide', 'https://example.com/b1', 'tester-a',
          'inferred_relative', 'osm_place');
select throws_ok(
  $$ insert into public.incidents (external_id, date, zone_id, hazard_type, source_url, added_by)
     values ('inc-1999-01-01-z4-landslide', '1999-01-02', 4, 'landslide', 'https://example.com/b1', 'tester-a') $$,
  '23505', null::text, 'incidents refuse a second row with the same CSV id');
select throws_ok(
  $$ insert into public.incidents (external_id, date, zone_id, hazard_type, source_url, added_by)
     values ('inc-1999-01-01-z4-landslide-2', '1999-01-03', 4, 'landslide', 'https://example.com/b1', 'tester-a') $$,
  '23514', null::text, 'incidents refuse a badly formed CSV id');
select throws_ok(
  $$ insert into public.incidents (date, zone_id, hazard_type, source_url, added_by, coord_basis)
     values ('1999-01-04', 4, 'landslide', 'https://example.com/b1', 'tester-a', 'guessed') $$,
  '23514', null::text, 'incidents refuse an unknown coord_basis');

-- Risk job scheduler (A6): only the owner and pg_cron can start the job.
set local role postgres;
select is(has_function_privilege('anon', 'private.dispatch_risk_job()', 'execute'), false,
  'anon cannot start the risk job');
select is(has_function_privilege('authenticated', 'private.dispatch_risk_job()', 'execute'), false,
  'signed-in users cannot start the risk job');
select is((select schedule from cron.job where jobname = 'risk-job-dispatch'), '7,37 * * * *',
  'pg_cron starts the risk job at :07 and :37');

-- The web app's database login (ORM): no privileges of its own, may only become anon or authenticated.
select is((select rolsuper or rolbypassrls or rolinherit or rolcreaterole from pg_roles where rolname = 'routeguard_app'),
  false, 'routeguard_app: not superuser, no RLS bypass, no inherit, no createrole');
select is((select array_agg(r.rolname::text order by r.rolname)
           from pg_auth_members am join pg_roles r on r.oid = am.roleid join pg_roles m on m.oid = am.member
           where m.rolname = 'routeguard_app'),
  array['anon', 'authenticated'], 'routeguard_app: member of anon and authenticated only');
select is((select bool_or(am.inherit_option) or not bool_and(am.set_option)
           from pg_auth_members am join pg_roles m on m.oid = am.member where m.rolname = 'routeguard_app'),
  false, 'routeguard_app: may switch to those roles but does not inherit their rights');
select is(has_table_privilege('routeguard_app', 'public.users', 'select')
          or has_table_privilege('routeguard_app', 'public.zones', 'select'),
  false, 'routeguard_app: reads nothing without switching role first');

-- Shared rate limits (C3, 20261125140000_rate_limits.sql), as the app's
-- signed-out role. The private schema isn't exposed by the REST API.
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select is((select allowed from private.rate_limit_hit('pgtap:limit', 2, 3600)), true, 'rate limit: first hit allowed');
select is((select allowed from private.rate_limit_hit('pgtap:limit', 2, 3600)), true, 'rate limit: second hit allowed');
select is((select allowed::text || ' ' || hits || ' ' || (retry_after_seconds > 0)::text
           from private.rate_limit_hit('pgtap:limit', 2, 3600)),
  'false 3 true', 'rate limit: third hit refused, with a wait time');
select is((select allowed from private.rate_limit_hit('pgtap:other', 2, 3600)), true, 'rate limit: buckets count separately');
select throws_ok($$ select * from private.rate_limit_hit('', 2, 60) $$,
  '22023', null::text, 'rate limit: refuses an empty bucket');
select throws_ok($$ select * from private.rate_limit_hit('pgtap:x', 2, 100000) $$,
  '22023', null::text, 'rate limit: refuses a window longer than a day');
select throws_ok($$ select * from private.rate_limits $$,
  '42501', null::text, 'anon: cannot read rate_limits');
select throws_ok($$ select private.rate_limits_cleanup() $$,
  '42501', null::text, 'anon: cannot run the rate limit cleanup');
set local role postgres;
select is((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where p.proname = 'rate_limit_hit' and n.nspname = 'public'),
  0::bigint, 'rate_limit_hit is not in the public schema (no REST access)');
select is((select schedule from cron.job where jobname = 'rate-limits-cleanup'), '23 * * * *',
  'pg_cron clears old rate limit windows every hour');

-- ===========================================================================
-- Road reports (B2, 20261125160000_reports_write.sql): submit, duplicates,
-- confirmations and flags, through the private functions the API calls.
-- ===========================================================================
set local role postgres;
insert into public.users (id, role, display_name, verification_level) values
  ('user_testvouched1', 'driver', 'Vouched driver 1', 'agent_vouched'),
  ('user_testvouched2', 'driver', 'Vouched driver 2', 'agent_vouched');
create temp table report_rules (j jsonb);
grant select on report_rules to public;
insert into report_rules values ('{"expiry_hours": {"landslide": 6, "rockfall": 6, "flash_flood": 6, "snow_ice": 12, "accident": 3, "other": 3},
  "duplicate": {"within_m": 500, "within_minutes": 60}, "confirm": {"needed": 2, "within_m": 2000, "within_hours": 3},
  "hide_after_flags": 3}');

-- An email-level driver: unconfirmed; the same client id again is a repeat.
set local role authenticated;
set local request.jwt.claims = '{"sub": "user_testdriver", "role": "authenticated", "metadata": {"role": "driver"}}';
select is((select status || ' ' || outcome from private.submit_report('00000000-0000-4000-8000-0000000000c1',
  'landslide', 33.2000, 75.1500, 3::smallint, 'pgTAP report', null, (select j from report_rules))),
  'unconfirmed created', 'reports: an email-level driver''s report starts unconfirmed');
select is((select status || ' ' || outcome from private.submit_report('00000000-0000-4000-8000-0000000000c1',
  'landslide', 33.2000, 75.1500, 3::smallint, 'pgTAP report', null, (select j from report_rules))),
  'unconfirmed repeat', 'reports: the same client id again returns the first report');
select lives_ok($$ select * from private.submit_report('00000000-0000-4000-8000-0000000000c3',
  'other', 33.3000, 75.2500, 4::smallint, null, null, (select j from report_rules)) $$,
  'reports: a second, separate report for the flag tests');

-- A vouched driver: the same hazard 200 m away merges; elsewhere is confirmed at once.
set local request.jwt.claims = '{"sub": "user_testvouched1", "role": "authenticated", "metadata": {"role": "driver"}}';
select is((select status || ' ' || outcome from private.submit_report('00000000-0000-4000-8000-0000000000c2',
  'landslide', 33.2018, 75.1500, 3::smallint, null, null, (select j from report_rules))),
  'unconfirmed merged', 'reports: the same hazard within 500 m and 60 min becomes a confirmation');
select is((select status || ' ' || outcome from private.submit_report('00000000-0000-4000-8000-0000000000c4',
  'rockfall', 33.5000, 75.2000, 5::smallint, null, null, (select j from report_rules))),
  'confirmed created', 'reports: a vouched driver''s report is confirmed at once');
select throws_ok($$ select * from private.submit_report('00000000-0000-4000-8000-0000000000c5',
  'rockfall', 33.6000, 75.2000, 5::smallint, null, 'user_testdriver/00000000-0000-4000-8000-0000000000c5.webp',
  (select j from report_rules)) $$,
  '42501', null::text, 'reports: cannot attach a photo from someone else''s folder');

set local request.jwt.claims = '{"sub": "user_testgrower", "role": "authenticated", "metadata": {"role": "grower"}}';
select throws_ok($$ select * from private.submit_report('00000000-0000-4000-8000-0000000000c6',
  'rockfall', 33.6000, 75.2000, 5::smallint, null, null, (select j from report_rules)) $$,
  '42501', null::text, 'reports: a grower cannot post a road report');

set local role postgres;
create temp table report_ids as
  select client_id, id from public.reports where client_id in
    ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000c3', '00000000-0000-4000-8000-0000000000c4');
grant select on report_ids to public;
set local role authenticated;

-- Confirmations: the second verified driver nearby makes it confirmed.
set local request.jwt.claims = '{"sub": "user_testvouched2", "role": "authenticated", "metadata": {"role": "driver"}}';
select is((select status || ' ' || confirmations || ' ' || outcome from private.confirm_report(
  (select id from report_ids where client_id = '00000000-0000-4000-8000-0000000000c1'), 33.2100, 75.1500,
  (select j from report_rules))),
  'confirmed 2 confirmed', 'reports: two verified drivers within 2 km confirm it');
select is((select outcome from private.confirm_report(
  (select id from report_ids where client_id = '00000000-0000-4000-8000-0000000000c1'), null, null,
  (select j from report_rules))),
  'repeat', 'reports: a second confirmation by the same person counts once');

set local request.jwt.claims = '{"sub": "user_testdriver", "role": "authenticated", "metadata": {"role": "driver"}}';
select throws_ok($$ select * from private.confirm_report(
  (select id from report_ids where client_id = '00000000-0000-4000-8000-0000000000c1'), null, null,
  (select j from report_rules)) $$,
  '42501', null::text, 'reports: cannot confirm your own report');

set local request.jwt.claims = '{"sub": "user_testdriver2", "role": "authenticated", "metadata": {"role": "driver"}}';
select throws_ok($$ select * from private.confirm_report(
  (select id from report_ids where client_id = '00000000-0000-4000-8000-0000000000c4'), null, null,
  (select j from report_rules)) $$,
  '42501', null::text, 'reports: an unverified driver cannot confirm');

-- Flags: three different people hide an unconfirmed report.
set local request.jwt.claims = '{"sub": "user_testgrower", "role": "authenticated", "metadata": {"role": "grower"}}';
select is((select status || ' ' || outcome from private.flag_report(
  (select id from report_ids where client_id = '00000000-0000-4000-8000-0000000000c3'), 'not_there',
  (select j from report_rules))),
  'unconfirmed flagged', 'reports: one flag leaves it on the map');
select is((select status || ' ' || outcome from private.flag_report(
  (select id from report_ids where client_id = '00000000-0000-4000-8000-0000000000c3'), 'not_there',
  (select j from report_rules))),
  'unconfirmed repeat', 'reports: the same person flagging again counts once');
set local request.jwt.claims = '{"sub": "user_testagent", "role": "authenticated", "metadata": {"role": "agent"}}';
select is((select status from private.flag_report(
  (select id from report_ids where client_id = '00000000-0000-4000-8000-0000000000c3'), 'wrong_place',
  (select j from report_rules))),
  'unconfirmed', 'reports: two flags leave it on the map');
set local request.jwt.claims = '{"sub": "user_testpolice", "role": "authenticated", "metadata": {"role": "police"}}';
select is((select status from private.flag_report(
  (select id from report_ids where client_id = '00000000-0000-4000-8000-0000000000c3'), 'not_there',
  (select j from report_rules))),
  'hidden', 'reports: the third flag hides an unconfirmed report');
select throws_ok($$ select * from private.confirm_report(
  (select id from report_ids where client_id = '00000000-0000-4000-8000-0000000000c3'), null, null,
  (select j from report_rules)) $$,
  'P0002', null::text, 'reports: a hidden report cannot be confirmed');

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select throws_ok($$ select * from private.submit_report('00000000-0000-4000-8000-0000000000c7',
  'rockfall', 33.6000, 75.2000, 5::smallint, null, null, (select j from report_rules)) $$,
  '42501', null::text, 'anon: cannot call submit_report');

set local role postgres;
select is((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('submit_report', 'confirm_report', 'flag_report')),
  0::bigint, 'report functions are not in the public schema (no REST access)');
select is((select distance_m between 150 and 250 from public.report_confirmations
           where user_id = 'user_testvouched1'
             and report_id = (select id from report_ids where client_id = '00000000-0000-4000-8000-0000000000c1')),
  true, 'a merged duplicate keeps only the distance (about 200 m), not the position');
select is((select count(*) from information_schema.columns
           where table_schema = 'public' and table_name = 'public_reports' and column_name in ('has_photo', 'photo_path', 'user_id')),
  1::bigint, 'public_reports says whether there is a photo, but has no path or user id');

-- ===========================================================================
-- Fleet: invites, vouching, shipments, location, account deletion
-- ===========================================================================
set local role postgres;
insert into public.users (id, role, display_name, agent_id) values
  ('user_testdriver3', 'driver', 'Test driver 3', null);
create temp table invite_codes (who text primary key, code text);
grant all on invite_codes to public;

set local role authenticated;
set local request.jwt.claims = '{"sub": "user_testagent", "role": "authenticated", "metadata": {"role": "agent"}}';
insert into invite_codes select 'agent1', code from private.create_agent_invite(7);
select is((select code ~ '^[A-HJ-NP-Z2-9]{8}$' from invite_codes where who = 'agent1'), true,
  'fleet: an agent gets an 8-character invite code');
select is((select count(*) from public.agent_invites), 1::bigint, 'fleet: the agent sees their own invite');

set local request.jwt.claims = '{"sub": "user_testgrower", "role": "authenticated", "metadata": {"role": "grower"}}';
select throws_ok($$ select * from private.create_agent_invite(7) $$, '42501', null::text,
  'fleet: a grower cannot make invites');
select is((select count(*) from public.agent_invites), 0::bigint, 'fleet: a grower sees no invites');

set local request.jwt.claims = '{"sub": "user_testdriver2", "role": "authenticated", "metadata": {"role": "driver"}}';
select is((select outcome from private.accept_agent_invite(lower((select code from invite_codes where who = 'agent1')))),
  'joined', 'fleet: a driver joins with the code (any case)');
select is((select outcome from private.accept_agent_invite((select code from invite_codes where who = 'agent1'))),
  'repeat', 'fleet: using the same code again is a repeat');
select throws_ok($$ select * from private.accept_agent_invite('ZZZZZZZZ') $$, 'P0002', null::text,
  'fleet: an unknown code is not found');
set local request.jwt.claims = '{"sub": "user_testdriver3", "role": "authenticated", "metadata": {"role": "driver"}}';
select throws_ok($$ select * from private.accept_agent_invite((select code from invite_codes where who = 'agent1')) $$,
  '55000', null::text, 'fleet: a used code cannot be used by someone else');

set local role postgres;
select is((select agent_id from public.users where id = 'user_testdriver2'), 'user_testagent',
  'fleet: the driver is now in the new agent''s fleet');
set local role authenticated;

set local request.jwt.claims = '{"sub": "user_testagent2", "role": "authenticated", "metadata": {"role": "agent"}}';
select throws_ok($$ select * from private.vouch_driver('user_testdriver2') $$, 'P0002', null::text,
  'fleet: the old agent can no longer vouch for the driver');
set local request.jwt.claims = '{"sub": "user_testagent", "role": "authenticated", "metadata": {"role": "agent"}}';
select throws_ok($$ select * from private.vouch_driver('user_testdriver3') $$, 'P0002', null::text,
  'fleet: an agent cannot vouch for a driver outside their fleet');
select is((select verification_level || ' ' || outcome from private.vouch_driver('user_testdriver2', 'req-pgtap-vouch')),
  'agent_vouched vouched', 'fleet: an agent vouches for their driver');
select is((select outcome from private.vouch_driver('user_testdriver2')), 'repeat',
  'fleet: vouching twice is a repeat');

-- Shipments
select lives_ok($$ insert into public.shipments (created_by, agent_id, driver_id, truck_number, tonnes)
                   values ('user_testagent', 'user_testagent', 'user_testdriver2', 'JK05G7712', 9) $$,
  'shipments: an agent adds a shipment with a driver from their fleet');
select throws_ok($$ insert into public.shipments (created_by, agent_id, truck_number, tonnes)
                    values ('user_testagent', 'user_testagent', 'JK05G7712', 9) $$,
  '23505', null::text, 'shipments: a second active shipment for the same truck is refused');
select throws_ok($$ insert into public.shipments (created_by, agent_id, driver_id, tonnes)
                    values ('user_testagent', 'user_testagent', 'user_testdriver3', 9) $$,
  '23514', null::text, 'shipments: a driver outside the fleet is refused');
select throws_ok($$ insert into public.shipments (created_by, agent_id, tonnes)
                    values ('user_testagent', 'user_testagent2', 9) $$,
  '42501', null::text, 'shipments: an agent cannot add to another agent''s board');
select throws_ok($$ update public.shipments set last_seen_at = now() where id = '00000000-0000-4000-8000-0000000000a1' $$,
  '42501', null::text, 'shipments: an agent cannot write last_seen_at');
set local request.jwt.claims = '{"sub": "user_testgrower", "role": "authenticated", "metadata": {"role": "grower"}}';
select throws_ok($$ insert into public.shipments (created_by, agent_id, tonnes)
                    values ('user_testgrower', 'user_testagent', 9) $$,
  '42501', null::text, 'shipments: a grower cannot put a lot on an agent''s board');

-- Location (S1: agent 1, driver 1)
set local request.jwt.claims = '{"sub": "user_testdriver", "role": "authenticated", "metadata": {"role": "driver"}}';
select throws_ok($$ select * from private.shipment_location('00000000-0000-4000-8000-0000000000a1', 33.2437, 75.1876) $$,
  '55000', null::text, 'location: refused while location sharing is off');
update public.users set location_consent = true where id = 'user_testdriver';
select lives_ok($$ select * from private.shipment_location('00000000-0000-4000-8000-0000000000a1', 33.2437, 75.1876) $$,
  'location: the assigned driver sends a position once sharing is on');
set local request.jwt.claims = '{"sub": "user_testdriver2", "role": "authenticated", "metadata": {"role": "driver"}}';
select throws_ok($$ select * from private.shipment_location('00000000-0000-4000-8000-0000000000a1', 33.2, 75.1) $$,
  'P0002', null::text, 'location: a driver not on the shipment cannot send one');

set local role postgres;
select is((select extensions.st_y(last_location::extensions.geometry) || ',' || extensions.st_x(last_location::extensions.geometry)
           from public.shipments where id = '00000000-0000-4000-8000-0000000000a1'),
  '33.24,75.19', 'location: stored rounded to about 1 km');
select is((select count(*) from public.audit_log where action in ('driver.joined_agent', 'driver.vouched')
           and target_id = 'user_testdriver2'), 2::bigint, 'fleet: joining and vouching are audited');
select is((select count(*) from pg_publication_tables where pubname = 'supabase_realtime'
           and schemaname = 'public' and tablename = 'shipments'), 1::bigint,
  'shipments changes are published to Realtime');

-- Account deletion
set local role authenticated;
set local request.jwt.claims = '{"sub": "user_testpolice", "role": "authenticated", "metadata": {"role": "police"}}';
select throws_ok($$ select * from private.delete_my_account((select j from report_rules)) $$, '55000', null::text,
  'delete account: police accounts are removed by an admin');
set local request.jwt.claims = '{"sub": "user_testvouched1", "role": "authenticated", "metadata": {"role": "driver"}}';
select lives_ok($$ select * from private.delete_my_account((select j from report_rules), 'req-pgtap-delete') $$,
  'delete account: a driver deletes their account');
set local role postgres;
select is((select count(*) from public.users where id = 'user_testvouched1'), 0::bigint,
  'delete account: the users row is gone');
select is((select count(*) from public.reports where client_id = '00000000-0000-4000-8000-0000000000c4' and user_id is null),
  1::bigint, 'delete account: their report stays, without their id');
select is((select count(*) from public.audit_log where action = 'user.deleted' and target_id = 'user_testvouched1'),
  1::bigint, 'delete account: the deletion is audited');
select is((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('create_agent_invite', 'accept_agent_invite', 'vouch_driver',
                                                          'shipment_location', 'delete_my_account')),
  0::bigint, 'fleet functions are not in the public schema (no REST access)');

select * from finish();

rollback;
