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

select plan(89);

-- ===========================================================================
-- Fixtures (as the owner, so RLS doesn't apply)
-- ===========================================================================
set local role postgres;

insert into public.users (id, role, display_name, agent_id) values
  ('user_testagent',   'agent',  'Test agent',    null),
  ('user_testagent2',  'agent',  'Test agent 2',  null),
  ('user_testdriver',  'driver', 'Test driver',   'user_testagent'),
  ('user_testdriver2', 'driver', 'Test driver 2', null),
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
select is((select state::text from public.road_status where item = 'mughal_road'),
  'unknown', 'a grower did not change road_status');
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

-- Risk job scheduler (A6): only the owner and pg_cron can start the job.
set local role postgres;
select is(has_function_privilege('anon', 'private.dispatch_risk_job()', 'execute'), false,
  'anon cannot start the risk job');
select is(has_function_privilege('authenticated', 'private.dispatch_risk_job()', 'execute'), false,
  'signed-in users cannot start the risk job');
select is((select schedule from cron.job where jobname = 'risk-job-dispatch'), '7,37 * * * *',
  'pg_cron starts the risk job at :07 and :37');

select * from finish();

rollback;
