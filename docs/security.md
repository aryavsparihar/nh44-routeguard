# Security

RouteGuard is advisory and not an official police service.

## How do we stop X?

Each row names the protection, where it lives and what tests it. "CI" means it runs on every pull request in `.github/workflows/ci.yml`.

| Threat | How we stop it | Where | Tested by |
| --- | --- | --- | --- |
| Signed-out or wrong-role access to the API | `withApi({ access })` checks the Clerk session and role before any handler runs: 401 signed out, 403 wrong role | `src/server/http/with-api.ts`, `guards.ts` | `with-api.test.ts`, `guards.test.ts`; `app/api/routes.test.ts` fails if a route skips `withApi()` |
| Signed-out or wrong-role access to pages | `proxy.ts` sends signed-out visitors of `/board`, `/report/new`, `/admin/...` to sign-in; each page calls `requirePageRole()` (wrong role shows 404) | `proxy.ts`, `src/server/auth/page.ts` | `protected-pages.test.ts`, `proxy.test.ts` |
| A route that forgets a check | Row Level Security on every table: each request's transaction switches to `anon` or `authenticated` with the caller's verified Clerk claims, and the database checks again. The app's login `routeguard_app` can read nothing without switching | `supabase/migrations/*_rls_*.sql`, `*_app_db_role.sql`, `src/server/db/index.ts` | `supabase/tests/rls.test.sql` (`npm run db:test`); a test fails if any table has RLS off; `src/server/db/rls.test.ts`; `npm run db:orm-check` on the real login |
| SQL injection | Queries are Drizzle query builders or `sql` templates, which send every value as a bound parameter, with values that passed zod `.strict()`. `sql.raw()` is allowed only in `src/server/db/`. Database errors keep only the SQLSTATE, never the SQL or its parameters | `src/server/**/*.repository.ts`, `src/server/http/db-errors.ts`, `src/server/http/body.ts` | `scripts/ci/check-no-sql-raw.sh` in CI; `users.repository.test.ts` checks the generated SQL; `db-errors.test.ts`; `body.test.ts` (unknown fields 422) |
| XSS (script in user text) | React escapes all text; `dangerouslySetInnerHTML` is banned; the CSP only runs scripts from our origin, Clerk and Cloudflare's captcha, and blocks `eval` in production | `src/server/security-headers.ts`, `scripts/ci/check-no-inner-html.sh` | `security-headers.test.ts`; CI fails on `dangerouslySetInnerHTML` |
| CSRF (another site posting as you) | Every POST, PUT, PATCH, DELETE must carry an `Origin` that matches our host, or it gets 403 before the handler runs. CSP `form-action 'self'` | `src/server/http/guards.ts` (`checkOrigin`) | `guards.test.ts`, `with-api.test.ts` ("403 for a cross-site POST") |
| Clickjacking (our page in someone's frame) | `frame-ancestors 'none'` and `X-Frame-Options: DENY` | `src/server/security-headers.ts` | `security-headers.test.ts` |
| Downgrade to http, MIME sniffing, leaking URLs | HSTS (2 years), `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `upgrade-insecure-requests`; no `X-Powered-By` | `security-headers.ts`, `next.config.ts` | `security-headers.test.ts` |
| Camera, location or mic used by something else | `Permissions-Policy`: camera and location for our own pages only, microphone, payment and USB off | `security-headers.ts` | `security-headers.test.ts` |
| Secret keys in git | `.env*` is gitignored (only `.env.example`); gitleaks scans every commit of a PR | `.gitignore`, CI job "Secret scan (gitleaks)" | CI |
| Secret keys in the browser | Secret keys are only read in modules that start with `import "server-only"`; after the build, CI searches the browser bundle and prerendered pages for secret key prefixes and names | `src/server/*`, `scripts/ci/check-bundle-secrets.sh` | CI ("No secret keys in the browser bundle or prerendered pages") |
| A setting nobody knows about | Every env var the app reads must be in `.env.example` | `scripts/ci/check-env-example.sh` | CI |
| Vulnerable dependencies | `npm audit`: high or critical anywhere fails CI; for packages that ship in the app, moderate already fails. Dependabot alerts are on for the repo (since 2026-11-24) | `.github/workflows/ci.yml`, repo settings | CI |
| Huge or malformed request bodies | JSON bodies over 32 KB get 413 (counted while reading, not trusted from `Content-Length`); wrong type 415; bad JSON 400; unknown or invalid fields 422 | `src/server/http/body.ts` | `body.test.ts` |
| Error messages leaking internals | Unknown errors become a generic 500 problem+json with only the request id; logs redact tokens, cookies and phone numbers and never log query strings | `src/server/http/problem.ts`, `logger.ts` | `problem.test.ts`, `with-api.test.ts`, `logger.test.ts` |
| Someone giving themselves police or admin | Users can only pick grower, trader, agent or driver; column grants stop a user token writing `users.role`; only `admin_set_role()` changes roles (admin only, not on yourself, reason required) | `supabase/migrations/20261124200000_admin_set_role.sql`, `src/server/users/` | `rls.test.sql`, `users.routes.test.ts` |
| Editing or deleting the audit log | Rows only come from `write_audit()`, which takes the actor from the token; a trigger refuses update, delete and truncate, even by the owner | `20261124160007_rls_policies.sql` | `rls.test.sql` |
| Bad query strings returning everything | Every query string goes through a zod `.strict()` schema (`readQuery`): `?zone=abc`, an unknown horizon or an extra parameter is a 400 problem+json, never an unfiltered 200 (L7). Cursors must match their exact format | `src/server/risk/risk.schemas.ts`, `src/server/schemas/zone-query.ts`, `src/server/incidents/incidents.schemas.ts` | `risk.routes.test.ts`, `lists.routes.test.ts` |
| Personal data in public lists | Public lists select named columns only: reports come from the `public_reports` view (no user id), official updates leave out `created_by`, incidents show verified rows only | `src/server/reports/`, `src/server/official-updates/`, `src/server/incidents/` | `lists.routes.test.ts`; `rls.test.sql` for the view |
| Nonsense advice input | `POST /api/v1/advice` takes a zod `.strict()` body: known varieties and destinations, tonnes 0.1–40, whole days 0–120, light or heavy; anything else is 422. Nothing is stored | `src/server/advice/advice.schemas.ts` | `advice.routes.test.ts` |
| Fake or untraceable official updates | Only police and admins can post (`withApi` role check, then RLS). Every update needs an https source link (no `http:`, `javascript:` or user:password links; the database checks the prefix again) and who published it. Edits keep the old version; deletes are soft with a reason | `src/server/official-updates/`, `src/server/schemas/https-url.ts` | `admin.routes.test.ts`, `official-updates.schemas.test.ts`, `rls.test.sql` |
| A privileged change with no audit entry | Official update writes and road status changes run their `write_audit()` call in the same transaction, so a failed audit undoes the change. Role changes already do this inside `admin_set_role()` | `src/server/audit.ts` (`auditSql`), the repositories | `rls.test.sql` |
| Marking Mughal Road or the parcel train open without a source | `PATCH /api/v1/admin/road-status` is admin only and refuses "open"/"closed" without an https source | `src/server/road-status/` | `admin.routes.test.ts`, `rls.test.sql` |

### Gaps we know about

- **Rate limits.** Section 10's limits (role attempts, admin writes, reports, 60 advice requests a minute per IP) wait for the shared rate limiter (section 17). Routes that need one carry `TODO(rate-limit)`.
- **Photo uploads.** File type checks by magic bytes and size limits come with the reports API (B2).
- **XSS test on report notes.** A test that saves `<script>` in a note and checks it shows as text comes with the reports API (B2).
- **Error tracking.** Sentry comes with A7.
- **Inline scripts.** The CSP allows inline scripts because nonces don't work with Partial Prerendering. See `docs/decisions.md` (A5).
## Security headers

`next.config.ts` sends these on every response (pages, API and static files). They are built in `src/server/security-headers.ts`.

- `Content-Security-Policy`: scripts only from our origin (inline allowed), the Clerk host for our instance, Cloudflare's captcha and Clerk's bot protection. Connections only to our origin, Clerk, our Supabase project (https and wss), the map tiles and Clerk's bot protection. No plugins, no framing by other sites, forms post only to us. `eval` only in development.
- The Clerk host is decoded from `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and the Supabase host comes from `NEXT_PUBLIC_SUPABASE_URL`, so the policy names exact hosts, not wildcards. Without keys, those hosts are left out.
- `CSP_REPORT_ONLY=1` sends the same policy as report-only (the browser logs problems in the console and blocks nothing). It is an emergency switch for deploy day only.
- `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Cross-Origin-Opener-Policy`, `Permissions-Policy`.

Checked in a browser on 2026-11-24 with `next start`: the home page, `/status` and Clerk's sign-in form (up to the email code screen) load with no CSP violations in the console.

## How RLS works here

The API checks roles in `withApi()`. The database checks again with Row Level Security, so a route that forgets a check still can't leak or change rows. The server talks to Postgres with Drizzle as `routeguard_app`, a login with no rights of its own: each request is one transaction that switches to `anon` or `authenticated` and sets the caller's Clerk claims (`sub`, `metadata.role`), which is what `auth.jwt()` reads. Only the hourly risk job (GitHub Actions) and the seed script use the secret key, which skips RLS.

Policies read two values from the Clerk token:

- `private.jwt_sub()`: the Clerk user id (`user_...`), or null when signed out.
- `private.jwt_role()`: `metadata.role` from Clerk public metadata, which users can't edit.

Migrations: `supabase/migrations/20261124160006_rls_helpers.sql` and `20261124160007_rls_policies.sql`. Tests: `supabase/tests/rls.test.sql` (run `npm run db:test`; everything is rolled back). `supabase test db --remote` does the same but needs Docker.

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
| `admin_set_role()` (function) | – | admins only, never on themselves, reason required; writes the role and the audit row in one transaction | non-admin, self-change, empty reason blocked; audit row checked |
| `idempotency_keys` | your own | your own | someone else's key blocked |
| `weather_readings` | nobody | risk job only | – |

Signed-out visitors (`anon`) have no access at all to `users`, `reports`, `shipments`, `verifications`, `report_confirmations`, `report_flags`, `audit_log` and `idempotency_keys`.

The tests also check that every table in `public` has RLS on, and that the database refuses 50 tonnes, a 281-character note and an official update that ends before it starts.

## Roles

- A user picks grower, trader, agent or driver once (`POST /api/v1/me/onboarding`). police and admin are granted only by an admin with a reason (`PATCH /api/v1/admin/users/{id}/role`), and every change is in `audit_log`.
- The role lives in Clerk `publicMetadata.role` (users can't edit it) and is mirrored in `users.role`. The database is written first, then Clerk, so the token never holds a role the database and the audit log don't know about.
- Pages: `proxy.ts` sends signed-out visitors of `/board`, `/report/new` and `/admin/...` to sign-in; each page then checks the role with `requirePageRole()`. API routes: `withApi()` checks every route, and `app/api/routes.test.ts` fails if a route skips it.
