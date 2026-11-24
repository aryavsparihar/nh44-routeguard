# Security

RouteGuard is advisory and not an official police service.

## How RLS works here

The API checks roles in `withApi()`. The database checks again with Row Level Security, so a route that forgets a check still can't leak or change rows. The app talks to Supabase with the publishable key and the caller's Clerk session token. Only the hourly risk job (GitHub Actions) uses the secret key, which skips RLS.

Policies read two values from the Clerk token:

- `private.jwt_sub()`: the Clerk user id (`user_...`), or null when signed out.
- `private.jwt_role()`: `metadata.role` from Clerk public metadata, which users can't edit.

Migrations: `supabase/migrations/20261124160006_rls_helpers.sql` and `20261124160007_rls_policies.sql`. Tests: `supabase/tests/rls.test.sql` (run `npx supabase test db --remote`; everything is rolled back).

| Table | Who reads | Who writes | Tested |
| --- | --- | --- | --- |
| `zones`, `hexes`, `risk_scores` | everyone | risk job only | – |
| `incidents` | everyone, verified rows only | risk data team (secret key) | anon sees no unverified rows |
| `road_status` | everyone | admins update | grower update changes nothing |
| `official_updates` | everyone (not deleted); police and admins also see deleted ones | police and admins, as themselves; no hard delete | grower blocked, police allowed, deleted hidden |
| `reports` | the author; admins | add: as yourself, unconfirmed, source matches role. Admins update | wrong source, pre-confirmed, other name all blocked |
| `public_reports` (view) | everyone; no `user_id`, no `photo_path`, no hidden rows | nobody (read-only) | columns absent, hidden row absent, write blocked |
| `report_confirmations` | your own; admins | driver, agent, police, admin; not your own report | own report blocked, grower blocked |
| `report_flags` | your own; admins | any signed-in user, once per report | second flag refused |
| `users` | your own row; agents their drivers; admins all | create your own row with grower/trader/agent/driver; update only `display_name`, `language`, `location_consent`, `consent_version` | self-promotion, police sign-up, verification level all blocked |
| `shipments` | the owner agent, the creator, the assigned driver; admins | growers, traders and agents create as themselves; the owner agent updates and can't hand it to another agent | other agent's shipment hidden and unchanged |
| `verifications` | admins | server functions only (A4, P1) | driver can't verify themselves |
| `audit_log` | admins | only through `write_audit()`; no update, delete or truncate, even by the owner | all three blocked, actor taken from token |
| `idempotency_keys` | your own | your own | someone else's key blocked |
| `weather_readings` | nobody | risk job only | – |

Signed-out visitors (`anon`) have no access at all to `users`, `reports`, `shipments`, `verifications`, `report_confirmations`, `report_flags`, `audit_log` and `idempotency_keys`.

The tests also check that every table in `public` has RLS on, and that the database refuses 50 tonnes, a 281-character note and an official update that ends before it starts.
