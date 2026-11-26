# Decision log

One line per decision: date, what we decided, and why. Newest at the bottom.

## Phase 0: setup

- **2026-11-10** · Supabase project in Mumbai (`ap-south-1`), Vercel functions in `bom1` · Users are in J&K. Database and server sit next to each other.
- **2026-11-10** · Supabase CLI commands use `--remote` (`db push`, `db query`, `gen types`) · CLI v3 targets a local database by default. Wrapped in `npm run db:push` / `db:types`.
- **2026-11-10** · Pages that read the database call `connection()` inside `<Suspense>` · Next.js 16 has Cache Components on, so without it the data would be frozen at build time instead of fetched on each visit.
- **2026-11-10** · `vercel.json` pins `"framework": "nextjs"` · The project was imported while `main` only had a README, so Vercel picked "Other" and served a 404.
- **2026-11-10** · The app uses only the publishable key. The secret key lives only in GitHub Actions secrets · The publishable key is safe in the browser because RLS protects the data. The secret key skips RLS.

## Phase 0: risk job

- **2026-11-10** · Rules before ML · Only ~10 documented incidents, far too few to train or validate a model. Rules are transparent and easy to tune in a backtest.
- **2026-11-10** · Score zones before hexagons · The 6 zones are ready now; hexagons wait for Navaya's CSVs. The hexagon code is written but only runs when both files exist.
- **2026-11-10** · Cron at minute 7 (`7 * * * *`) · GitHub often delays top-of-hour schedules.
- **2026-11-10** · All times stored in UTC (`timezone=GMT` in Open-Meteo, `timestamptz` in Postgres) · One clock everywhere; the app converts to IST for display.
- **2026-11-10** · All model settings in one shared `lib/risk/config.json` · The Python job and the Next.js app read the same numbers, so they can't drift apart.
- **2026-11-10** · Every threshold and exposure value is marked as our own starting value · None are from published sources yet; the backtest will tune them.
- **2026-11-10** · Open-Meteo `forecast_days=3` instead of 2 · With 2, the data ends at 23:00 UTC tomorrow, so most runs couldn't see 48 h ahead.
- **2026-11-10** · Flash flood uses the heaviest 3 h within the last 24 h; black ice counts the road as wet after any rain/snow in the last 24 h · The brief didn't fix these windows; 24 h matches the other short windows.
- **2026-11-10** · Weather points checked against an OSRM Jammu→Srinagar route on OpenStreetMap roads · Overpass was down (502/504 from every mirror). The route follows NH-44, and ~80% of it is tagged `ref=NH44`.
- **2026-11-10** · 7 places left for picking by hand (Dewal, Kheri, Samroli, Dalwas, Mehar/Cafeteria Morh, Battery Chashma, Khooni Nallah) · They aren't in OpenStreetMap, and we don't guess coordinates.
- **2026-11-10** · Store `level` (low/medium/high) in `risk_scores` · The advice table reads it directly, so the app doesn't need its own copy of the cut-offs.
- **2026-11-10** · `latest_risk` view with `security_invoker = true` · The view follows the caller's RLS instead of bypassing it.
- **2026-11-10** · `--dry-run` reads nothing from the database · Teammates can run it with no key at all. Confidence then falls back to exposure.
- **2026-11-10** · After each hourly run, `check_run.py` checks for 24 fresh zone rows · A run that "succeeds" but writes nothing still turns red.

## Round 3: hosting

- **2026-11-24** · Drop Vercel completely · We want the app on a real cloud host, with one place to explain and pay for. Rejected: keeping Vercel for PR previews (two hosts to keep in sync). The `vercel.json` and `bom1` entries above are history; Step 0 in `docs/round3/BUILD_PROMPT.md` removes the leftovers.
- **2026-11-24** · Host on Azure Container Apps, on Aryaveer's Azure for Students subscription · Google Cloud was the first choice (the demo app runs on Cloud Run), but its billing setup failed for us. Azure for Students needs no card, so it can't bill us; the US$100 credit runs to Nov 2027. Container Apps scales to zero when idle and up to 3 replicas under load. Rejected: AWS (needs a card, same problem as Google), Render (sleeps, slow first load during a demo).
- **2026-11-24** · No Azure resources until we're ready to deploy; images in GitHub Container Registry, not Azure Container Registry · The credit is all we have. ACR charges every day it exists; GHCR is free for our size.

## Round 3: API foundation (A1)

- **2026-11-24** · Every API route is wrapped in `withApi()` (`src/server/http/`) · One place for request ids, logging, the role check, the Origin check and problem+json errors, so each route stays short and no route can forget them.
- **2026-11-24** · Problem `type` is `about:blank` · RFC 9457's value for "nothing beyond the status code". We have no public domain to host problem pages on, and clients switch on `status`.
- **2026-11-24** · A bad query string is 400, a JSON body that breaks the rules is 422 · The API contract says 400 for "malformed JSON or query" and 422 for "valid JSON that breaks the rules". Both list the failing fields.
- **2026-11-24** · Writes need an `Origin` that matches our host, and a missing `Origin` is also 403 · Browsers always send it, so this blocks cross-site requests (CSRF). Postman and curl add it by hand. A server-to-server route can turn the check off and prove itself another way.
- **2026-11-24** · `getCaller()` returns "signed out" until A2 wires in Clerk · The plan says not to pick a Clerk app before the demo app's code is in the repo. Protected routes answer an honest 401 until then, and tests mock the caller.
- **2026-11-24** · Logs carry a 12-character SHA-256 hash of the user id and the path without the query string · We can follow one user's requests without storing who they are, and query strings can hold personal data.
- **2026-11-24** · vitest 5.1.0 rather than 5.1.1, and `@types/node` 20 → 24 · 5.1.1 was six days old (we use releases at least two weeks old). vitest 5 needs Node 22+ types, and we run Node 24 locally and in CI.

## Round 3: Clerk and Supabase (A2)

- **2026-11-24** · Clerk application `app_3MY5xJ8fczFe0sOEafACBTW6tNY`, installed by hand (`@clerk/nextjs` 7.9.25) instead of `clerk init` · It is the app picked in the Clerk dashboard. `init` writes keys into env files and can create a new app; we put keys in `.env.local` ourselves. 7.9.25 is the newest release at least two weeks old.
- **2026-11-24** · With no Clerk keys, Clerk is skipped and everyone is signed out · CI builds with no keys, and teammates can run the app before they have them. Same pattern as the Supabase env check. `NEXT_PUBLIC_CLERK_KEYLESS_DISABLED=1` stops Clerk from creating a throwaway app in development.
- **2026-11-24** · The role comes from the `metadata.role` session claim and must match one of our six roles exactly · Users can't edit Clerk public metadata from the browser, and checking the value means a broken or unexpected claim gives "no role" instead of access.
- **2026-11-24** · Supabase gets Clerk's default session token, no JWT template · Supabase's native Clerk integration reads the session token directly. Clerk's JWT-template route for Supabase is deprecated (since 1 April 2025).
- **2026-11-24** · The server Supabase client uses only the publishable key; no secret-key "admin" client yet · Nothing in A2 needs to bypass RLS, and the secret key has so far lived only in GitHub Actions. We decide when the queue worker needs it (section 17).
- **2026-11-24** · Supabase calls time out after 5 s; no answer or a 502/503/504 gives a 503, other database errors a generic 500 · Clients can tell "try again" apart from a bug. Logs keep only the error code and message, because Postgres details can quote row values.
- **2026-11-24** · Sign-in by email code only, no phone SMS · SMS is a paid Clerk feature on our free Hobby plan (the dashboard flags it as paid), and we don't spend money. This changes the Round 1 promise of phone OTP: it is still a one-time code with no password, sent by email instead of SMS. The app copy says "email" everywhere and never claims "phone". We can add SMS later if the team pays for it.

## Round 3: database and RLS (A3)

- **2026-11-24** · `users.id` and every user foreign key changed from uuid to text (`user_...`) · Clerk ids are text, and the old link to Supabase Auth (`auth.users`) is gone because we sign in with Clerk. `users`, `reports` and `shipments` were empty, so nothing was lost.
- **2026-11-24** · `users.phone` and `users.verified` dropped · Phone numbers stay in Clerk only. `verification_level` replaces the yes/no flag.
- **2026-11-24** · `verification_level` defaults to `email` instead of the plan's `none` · Every account signs in with an email code, so an account that exists has already proved an email address.
- **2026-11-24** · `incidents.date` keeps its name and means the event start date · `seed.js` and the risk job read it. A column comment and `date_basis` say what it is; `event_end_date` is new.
- **2026-11-24** · Users can only write their own `display_name`, `language`, `location_consent` and `consent_version`, enforced by column grants · Postgres itself refuses an update to `role`, `verification_level` or `agent_id` with a user token. This replaces the trigger the plan mentioned: less code and nothing to forget.
- **2026-11-24** · The public map reads reports through a `public_reports` view without `user_id`, `photo_path` or hidden rows · The `reports` table stays closed to signed-out visitors, so who reported what never leaves the database. The view runs with its owner's rights on purpose; it is read-only.
- **2026-11-24** · Incidents are public only once a second person has verified them (`verified_by` set) · Section 14: the Phase 0 numbers don't hold up. The 6 current rows are hidden until Madhusudan's verified CSV replaces them.
- **2026-11-24** · "No quote, no number" check on incidents is `NOT VALID` · It applies to every new or changed row. The 6 Phase 0 rows have numbers and no quote, and they are being replaced anyway.
- **2026-11-24** · Flag reasons: `not_there`, `wrong_place`, `duplicate`, `offensive`, `other` · Our own starting list. WP-B can change it.
- **2026-11-24** · Policy helpers live in a `private` schema · The Data API only exposes `public`, so nobody can call them over `/rest/v1/rpc`.
- **2026-11-24** · `audit_log` rows come only from `write_audit()`, which takes the actor from the token; a trigger refuses every update, delete and truncate · Nobody can write an entry in someone else's name or remove one, not even the database owner.
- **2026-11-24** · RLS tests run with pgTAP on the real database inside one transaction that is rolled back · We have no Docker for a local database. Nothing the tests insert stays.

## Round 3: roles (A4)

- **2026-11-24** · `proxy.ts` only sends signed-out visitors of `/board`, `/report/new` and `/admin/...` to sign-in, with a plain path check instead of `createRouteMatcher` · `createRouteMatcher` is deprecated in `@clerk/nextjs` 7 because path matching in the proxy can miss how Next resolves a route. Clerk and the Next 16 auth guide both say to check access next to the data. So each page calls `requirePageRole()`, and the proxy is only a quick first check. This changes section 8, which named `createRouteMatcher`.
- **2026-11-24** · API paths are not protected in `proxy.ts` · `auth.protect()` answers a signed-out API call with 404, which would break our 401 problem+json contract. `withApi()` already checks every route, and `app/api/routes.test.ts` fails if a route skips `withApi()`.
- **2026-11-24** · Role changes write the database first, then Clerk · RLS trusts the role in the Clerk token. If Clerk went first and the database failed, someone would hold police or admin power with no `users` row and no audit entry. With the database first, a failure in between is fixed by sending the same request again.
- **2026-11-24** · Admin role changes go through the `admin_set_role` database function, which writes the audit row in the same transaction · A role can't change without a record, even if the API crashes halfway. A user token can't write `users.role` at all (column grants), so the function is the only way in.
- **2026-11-24** · Admins can't change their own role · Stops an admin from locking themselves (or the last admin) out by mistake. Another admin has to do it.
- **2026-11-24** · An admin can give a role to a Clerk user who has no `users` row yet · The demo police account can't onboard itself (police isn't self-service), so the admin's change creates the row.
- **2026-11-24** · Added `GET /api/v1/me` · The onboarding screen needs to know whether the user has picked a role. It is in the API contract (section 6); `PATCH` and `DELETE /me` come later.
- **2026-11-24** · Wrong role on a page shows the 404 page · Next 16's `forbidden()` is still experimental, and a 404 doesn't admit the page exists.
- **2026-11-24** · The first admin is set up by hand once (runbook step 6) · police/admin are never self-service and only an admin can grant them, so the first one needs a start outside the API. Its audit row says "bootstrap".
- **2026-11-24** · No rate limit on the role endpoints yet · Section 10 asks for 5 role attempts per user per hour, but the shared rate limiter (section 17) doesn't exist yet. Both routes carried a `TODO(rate-limit)` until C3 (below) added the limit on 2026-11-25.


## Round 3: security (A5)

- **2026-11-24** · The Content-Security-Policy has no nonce and allows inline scripts (`'unsafe-inline'`) · Next 16's CSP guide says nonces need every page rendered on each request and don't work with Partial Prerendering, which we use (`cacheComponents`). Section 16's fallback: a strict policy without nonces. Scripts still load only from our origin, Clerk and Cloudflare's captcha; React escapes all text and CI bans `dangerouslySetInnerHTML`. Subresource Integrity (experimental in Next 16) is the way to drop `'unsafe-inline'` later.
- **2026-11-24** · The Clerk and Supabase hosts in the CSP come from the public env vars · The Clerk publishable key is base64 of our instance's host, so decoding it gives the exact host for development and production with no `*.clerk.accounts.dev` wildcard. Without keys (CI builds), the hosts are left out.
- **2026-11-24** · Clerk's bot protection is allowed on any port (`https://*.protect.clerk.com:*` in `connect-src`) · In the browser check, Clerk's sign-in probed those hosts on ports 8443, 18443, 2082 and 992, and the CSP blocked them. The hosts are Clerk's own; only the port is open.
- **2026-11-24** · `eval` is allowed in development only · React uses it for better error messages in development. Production blocks it (checked in the browser: `eval` and `new Function` throw).
- **2026-11-24** · `CSP_REPORT_ONLY=1` turns the policy into report-only · An emergency switch for deploy day if the policy breaks something we didn't test. There is no report collector; violations show in the browser console.
- **2026-11-24** · The policy was checked in a local browser rather than shipped as report-only first · We have no production users yet, so a report-only period would collect nothing. We ran `next start`, loaded `/`, `/status` and Clerk's sign-in form, and read the console: no violations under the enforced policy.
- **2026-11-24** · HSTS without `preload` · Preload is a promise that the whole domain stays https forever, and we don't own a domain yet (Azure Container Apps gives us one).
- **2026-11-24** · The 7 moderate `npm audit` findings in lint tooling are left as they are · They are in `minimatch` via `typescript-eslint`, which never ships in the app. 0 high, 0 critical, 0 in production dependencies. CI fails on high anywhere and on moderate in production dependencies.
- **2026-11-24** · CI also scans prerendered pages for secret keys, checks that every env var is in `.env.example`, and bans `dangerouslySetInnerHTML` · Prerendered HTML and RSC payloads go to the browser too, not just `.next/static`. The other two turn CLAUDE.md rules into checks.

## Round 3: risk job (A6)

- **2026-11-24** · Reason codes keep the hours in `reason_params`, not in the code name (`rockfall_rain` + `{ "hours": 48 }`, not `rockfall_rain_48h`) · The hours come from `lib/risk/config.json` and will be tuned in the backtest. A code name with the number in it would need new translations every time.
- **2026-11-24** · `place` in `reason_params` is the weather point id (`z4_ramban`), not its name · Section 12: place names come from translation keys by id, spelled by the fluent reviewers.
- **2026-11-24** · `lib/risk/reason_codes.json` lists every code and its params · One list for the job (pytest checks it only writes what is listed, and `check_run.py` fails a run with an unknown code) and for the app's translations.
- **2026-11-24** · Supabase `pg_cron` starts the risk job through GitHub's "run workflow" API, at :07 and :37 · GitHub's own schedule ran the job every 6 to 12 hours instead of hourly, so the data was usually stale. Runs started through the API begin right away. `pg_cron`, `pg_net` and Vault are free and already part of our Supabase plan (section 17 plans them for the queue too); no new Azure resource. GitHub's schedule stays as a fallback.
- **2026-11-24** · The GitHub token for that call is a fine-grained token for this repository only, with "Actions: read and write", kept in Supabase Vault · The smallest permission that can start a workflow. It is added by hand (runbook) and never appears in the repo.
- **2026-11-24** · Automatic runs skip when the last run is under 40 minutes old · Makes the :37 call a free retry when :07 failed, and stops a late GitHub schedule run from writing a second run in the same hour. The Run workflow button always runs.
- **2026-11-24** · When Open-Meteo fails, the job still writes nothing rather than scoring with older stored weather · A fresh `run_at` on old weather would hide the staleness from the banner. The :37 retry covers most failures instead.
- **2026-11-24** · Open-Meteo gets 5 tries with waits of 10, 30, 60 and 120 seconds (was 4 tries over about 17 seconds) · All 4 failures in the week before were TLS handshake timeouts that the short waits didn't outlast. The worst case still fits in the workflow's 10-minute limit (a test checks it).

## Round 3: health and deploy (A7)

- **2026-11-24** · `/api/v1/health/ready` answers 200 with `stale: true` when the risk data is old, and 503 only when the database can't be reached · Old scores don't stop the app working; the screens show the stale banner. A 503 would tell the smoke test and an uptime check the app is down when it isn't.
- **2026-11-24** · `/ready` is not a Container Apps probe; the default TCP probes stay, plus an optional HTTP liveness probe on `/health` · If a probe used `/ready`, a short Supabase outage would take every replica out of service, and the pages that work without the database (and the offline app shell) would go down with it.
- **2026-11-24** · The 90-minute stale rule lives in one place, `src/shared/freshness.ts` · The API, `/status` and the coming banner must agree on what "stale" means.
- **2026-11-24** · Docker image from Next's `output: "standalone"`, on `node:24-alpine`, running as the non-root `node` user · The smallest image Next supports for self-hosting; no `node_modules` install at start-up.
- **2026-11-24** · Only public values are build arguments; secret keys are Container Apps secrets · `NEXT_PUBLIC_*` values and the CSP are fixed at build time (Next inlines them, and `headers()` runs at build), so they must be in the image. Secrets never are; CI checks the image has no `.env` file and no secret key patterns in browser files.
- **2026-11-24** · Images go to GitHub Container Registry, keeping the last 2 · Section 4.1: Azure Container Registry charges every day it exists. GHCR is free for this.
- **2026-11-24** · The deploy workflow runs on every push to `main`, but only when the repo variable `DEPLOY_ENABLED` is `true` · Until the Azure resources exist, every merge would otherwise fail.
- **2026-11-24** · `deploymentId` is the commit SHA · Next's version-skew protection: a browser still running the old version reloads instead of breaking during a deploy.
- **2026-11-24** · CI builds and smoke-tests the Docker image on every PR · Docker isn't installed on the machine we build on, so this is where the Dockerfile is proven before deploy day.
- **2026-11-24** · `HOSTNAME=0.0.0.0` in the image · With `127.0.0.1`, the standalone server failed to reach itself on `localhost` (seen locally: "Failed to proxy … socket hang up").
- **2026-11-24** · Sentry and an uptime check are not in A7 · Both are P1 and need new accounts. `/ready` is ready for an uptime check when we add one.

## Round 3: backtest (A8)

- **2026-11-24** · Lead times are tested on Open-Meteo's archived forecasts (Previous Runs API), not on the weather that actually happened · A backtest on actual weather assumes a perfect forecast and makes every lead look the same. The archived runs are what we would really have known 48 and 24 hours earlier. They start in February 2024 (checked 24 Nov 2026), so older events get only a "weather on the day" check on ERA5, labelled as such.
- **2026-11-24** · 12 h lead uses the newest archived run for the hours ahead · The API stores runs per whole day (made 0, 1 or 2 days before each hour); there is no 12-hours-earlier run. This is optimistic and says so in the caveats.
- **2026-11-24** · Events are scored at 12:00 IST on their date · Sources give a date, not a time.
- **2026-11-24** · A hit is the zone reaching medium or high; "right hazard" is the incident's hazard reaching 0.30 · The same cut-off the app uses for advice, so the backtest tests what users would have seen.
- **2026-11-24** · False alarms count medium-or-high days with no verified incident in that zone within a day, with the forecast from a day earlier · Our incident list is incomplete, so this is an upper bound; the page says so.
- **2026-11-24** · Only verified incidents go into `lib/risk/backtest.json` and `docs/backtest.md`; until B1 lands they say "not run" · Section 14: unverified rows are never used. `--preview-unverified` exists to check the pipeline, only prints, and refuses to write files; a test checks the committed file is never a preview.
- **2026-11-24** · `GET /api/v1/model` serves the card from `lib/risk/config.json` and the backtest file as they are · Nothing typed in by hand, so the API can't drift from the job.

## Round 3: incidents (B1)

- **2026-11-25** · The CSV's `event_start_date` loads into the existing `incidents.date`, and the CSV `id` goes into a new `external_id` · Keeps the risk job, RLS policy and tests that already use `date`. `external_id` lets `seed.mjs` upsert, so rerunning it updates rows instead of adding copies.
- **2026-11-25** · One row per date, zone and hazard; a closure that hit two zones is two rows · The risk model and the backtest work per zone. Shared rows say "same closure as" in `notes`.
- **2026-11-25** · A number is filled only when the 25-word `evidence_quote` contains it; other figures from the same article go into `notes` · Section 14 rule 5 ("no quote, no number"). "Over 300" is filled as 300 and noted as a lower bound. Corridor-wide counts are noted, not filled.
- **2026-11-25** · `date_basis` gains `inferred_relative` ("late last evening", "yesterday") · The three section 14 values had no honest label for those; `article_date` would give the wrong day.
- **2026-11-25** · Places missing from OpenStreetMap use the nearest named OSM place with `coord_basis = osm_place_nearby`; Jawahar Tunnel uses `osm_feature_old_road` and may be up to 4 km from today's line · Our saved line (`data/nh44_line.json`, from OSRM) follows the Navyug tunnel road opened in 2021; closures before that were on the old road through Jawahar Tunnel.
- **2026-11-25** · The zone is checked against km along the saved line, with 0.5 km of slack at boundaries · Section 14 rule 6. Boundaries are the km of each zone's first place in `jobs/points.json`.
- **2026-11-25** · `scripts/check_incident_sources.py` downloads every source (or its Wayback copy) and confirms the quote is on the page; it runs by hand, not in CI · Needs the network. Every row passed before checking. We only look up existing Wayback copies; we don't create new ones.
- **2026-11-25** · `verified_by` is filled only from the verifier's own ticks (`scripts/incidents_checklist.py --apply`) · Rule 8: the verifier opens each source. The tool refuses a verifier who is also `added_by`.
- **2026-11-25** · The risk job counts only verified, non-demo incidents for confidence · Its key skips RLS, so the "verified only" policy didn't filter for it.

## Round 3: ORM (Drizzle)

- **2026-11-25** · The web server's queries go through Drizzle ORM (`drizzle-orm` 0.45.4 with `postgres` 3.4.9, exact versions), not supabase-js over HTTP · The mentor asked for an ORM. Drizzle keeps queries typed and parameterised, is small, and has no engine binary. supabase-js stays only in the browser for Realtime; the Python job and `seed.mjs` keep using the secret key over HTTP because they are batch jobs, not request handlers.
- **2026-11-25** · RLS stays the access control: every request runs in one transaction that first does `set_config('role', 'anon' | 'authenticated')` and `set_config('request.jwt.claims', …)`, like Supabase's own API does · The policies, `auth.jwt()` and the pgTAP tests don't change. Only `anon` and `authenticated` are allowed (`src/server/db/index.ts`). The claims come from the Clerk session that `auth()` already verified on our server, so the database now trusts our server for who the caller is, instead of checking Clerk's token signature itself. Our server holds the Clerk secret key anyway, so this adds no new party to trust.
- **2026-11-25** · A new login, `routeguard_app`, with no rights of its own (`noinherit`, `nobypassrls`, may only switch to `anon` or `authenticated`) · Using `postgres` would skip RLS on any query that forgot to switch role. With this login such a query gets "permission denied" instead. pgTAP checks the role; `npm run db:orm-check` checks the real login. Its password is set by hand in the SQL editor and is never in git (`docs/runbook.md`).
- **2026-11-25** · Through the Supabase transaction pooler (port 6543), `prepare: false`, at most 5 connections per replica, 5 s statement timeout · Container Apps can run 3 replicas, and direct connections are limited on our plan. The pooler hands out a connection per transaction, which is exactly how `rls()` uses it; prepared statements don't work through it.
- **2026-11-25** · The SQL migrations stay the only way to change the database; no drizzle-kit · `src/server/db/schema.ts` is generated from the live database (`npm run db:schema`), like `lib/database.types.ts`. `schema.typecheck.ts` fails `npm run typecheck` if the two disagree. drizzle-kit would add a second migration system and its dev dependencies.
- **2026-11-25** · Database errors become `DbError(code)` with only the SQLSTATE; the SQL text and parameters are dropped · Drizzle's own error message contains the query and its parameters, which can include personal data, and our logs must not.
- **2026-11-25** · `sql.raw()` is allowed only inside `src/server/db/` (CI check `check-no-sql-raw.sh`) · Everything else uses `sql` templates, which bind every value as a parameter.
- **2026-11-25** · The users insert uses a narrow table (`ownUserInsert`) with only the columns a user may set · Drizzle lists every column in an INSERT (with `default`), and the column-level grant on `users` refuses that.

## Round 3: app shell and languages (D1)

- **2026-11-25** · English, Hindi and Urdu with `next-intl` 4.15.0; the language lives in the `rg_lang` cookie and never in the URL · URLs stay `/board`, so links, the service worker and Clerk don't need to know about languages. On a first visit the phone's language decides; unknown languages get English.
- **2026-11-25** · A hidden `app/[locale]` folder after all (BUILD_PROMPT section 12 said "no `[locale]` folders") · With `cacheComponents` on, reading the cookie in the root layout would make every page uncacheable or fail the build. `proxy.ts` rewrites `/board` to `/ur/board` inside the server, Next builds one cached page per language with the right `<html lang dir>` on the first paint, and the visitor never sees the folder. This is next-intl's documented `localePrefix: "never"` setup with `next/root-params`.
- **2026-11-25** · Changing the language reloads the page · It changes `<html lang dir>`, the fonts and every word; a reload is the simplest way to get all of them right.
- **2026-11-25** · Fonts from the Round 2 style guide (Barlow Semi Condensed, Atkinson Hyperlegible) plus Noto Sans Devanagari and Noto Nastaliq Urdu, through `next/font` · They are downloaded at build time and served from our own site, so the CSP keeps `font-src 'self'` and no visitor request goes to Google. The Hindi and Urdu fonts are not preloaded; a phone downloads them only for that language.
- **2026-11-25** · Latin digits in all three languages, and values inside sentences wrapped in Unicode isolate marks (`isolate()`, the text form of `<bdi>`) · Truck numbers and times read the same everywhere, and "16:07" or "+48 h" can't be reordered inside Urdu text (L4). The Urdu reviewer can change the digits.
- **2026-11-25** · Hindi and Urdu text is machine-drafted and marked "not yet reviewed" in `messages/REVIEW.md` · BUILD_PROMPT section 9: a fluent reader has to check the safety text before we rely on it.
- **2026-11-25** · Icons are generated from `docs/ux/assets/icons/*.svg` into React components (`npm run ui:icons`) · Inline SVG takes the text colour and needs no `dangerouslySetInnerHTML`; the Round 2 files stay the one source.

## Round 3: risk read path and map (C1, C2)

- **2026-11-25** · `GET /api/v1/risk` returns every zone row of the newest run (6 zones × 4 times) when called without filters · The map and the 48 h strip need all of it, so one request serves both screens and the horizon buttons switch without another call.
- **2026-11-25** · Caching: ETag = the run time, 304 on a match, `Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=3300`, and a 60 s copy in memory per server instance · Scores change once an hour and are the same for everyone (section 17). No Redis: nobody has created an Upstash account, so the shared cache is not built; the in-memory and HTTP caches are what we claim.
- **2026-11-25** · Risk reasons are built from `reason_code` + `reason_params` with messages in each language; if a code is unknown or a param looks wrong, the screen shows the job's English sentence with an "English only" tag · Never a half-translated or broken sentence (L4). Place names keep their English spelling until a reviewer confirms them.
- **2026-11-25** · Worst-zone card: "all zones low" when nothing is above low; otherwise highest level, then score, then the zone more exposed to its hazard, then zone order (`worstZone()` in `src/shared/risk.ts`) · L2: a tie at 0.00 must never crown zone 1.
- **2026-11-25** · MapLibre GL `6.17.0` with OpenFreeMap's `positron` style (free, no key, OpenStreetMap data) · Already allowed in the CSP. Its worker file is copied from `node_modules` into `public/vendor/` before `dev` and `build` (`scripts/ui/copy-maplibre-worker.mjs`, gitignored output), because MapLibre 6 loads it by URL and the bundler doesn't emit it. A test fails if the version in the URL and `package.json` drift apart.
- **2026-11-25** · The map is a picture of the zone list: one `role="img"` label, and the list below it has the same facts as text · Screen readers, phones without WebGL and a failed tile server all still get the risk. Line width as well as colour shows the level.
- **2026-11-25** · The road line is `data/nh44_line.json` cut at `zone_starts_km`, done once on the server (`src/shared/corridor.ts`) · No extra request; the browser gets about 800 points.
- **2026-11-25** · `GET /api/v1/reports` (read) arrives now with the map; writing reports comes with B2 · The map needs the markers; the list shows only what the `public_reports` view already exposes (no user ids).

## Round 3: advice (E1, C4)

- **2026-11-25** · One `decide()` in `src/shared/decide.ts` runs on the server (`POST /api/v1/advice`) and on the phone · Online, the advisor asks the server, so the answer comes from our backend (L12). With no signal, the phone runs the same function on the scores it saved last and says "worked out on this phone". A test sends the same inputs to both and expects the same answer.
- **2026-11-25** · The Round 1 rules (SEND / HOLD / RAIL / DIVERT) from the Round 2 prototype, except Mughal Road and the parcel train · They are suggested only when an admin has marked them open / running in `road_status`. Unknown says "check with J&K Traffic Police (TCU)" or "check with Northern Railway" (L14). No month-based "in season" guess.
- **2026-11-25** · No scores at all gives HOLD, never SEND · We can't call a road safe without data.
- **2026-11-25** · Priority is a band (high / medium / low) with its inputs shown: share of shelf life used × load value in lakh rupees (L13) · A bare "2.00" meant nothing. The shelf-life days, ₹/kg, road hours and band cut-offs live in `config/advice-assumptions.json` (versioned) and are labelled "our starting assumptions, not sourced figures" on screen. On 2026-11-25 we looked for sources (Azadpur APMC prices, NHB and Indian shelf-life studies) and found none we could cite for a loaded truck, so the prototype's placeholder values stay as starting values.
- **2026-11-25** · Advice answers are codes (`reason_code`, `delay_code`, `notes`) translated on the phone · Same words in all three languages, and the shipment board can store the code with `rules_version`.
- **2026-11-25** · When every zone is low, the advisor doesn't name a "deciding" zone · Same reason as L2: a tie at 0.00 must not point at zone 1.

## Round 3: official updates, road status, admin (B3)

- **2026-11-25** · Editing an official update makes a new version: the old row is closed ("Replaced by version n") and a new row carries the change, `version + 1` and `supersedes_id` · People can see what was shown before, and nothing is overwritten. The edit claims the old row with `where deleted_at is null`, so two edits at once can't both win (the second gets 409).
- **2026-11-25** · Deleting is a soft delete with a written reason; there is no hard delete (no RLS delete policy) · Section 12. The history and the audit log keep it.
- **2026-11-25** · The change and its audit row are written in one transaction (`auditSql()` inside `db.rls()`) · A failed audit insert undoes the change, so there is never a privileged change without a log entry.
- **2026-11-25** · Road status is set one item at a time, and "open" or "closed" needs an https source link; "unknown" clears it · L14: the advisor only suggests Mughal Road or the parcel train with a source behind it.
- **2026-11-25** · Admin forms take times in IST (`datetime-local` read as +05:30) · Every time the app shows is IST; a phone set to another time zone would otherwise post the wrong time.
- **2026-11-25** · Roles are given by Clerk user id on `/admin/users`; there is no user search yet · Section 8 asks only for `PATCH /api/v1/admin/users/{id}/role`. A list of users would show personal data, so we wait until it is needed.
- **2026-11-25** · Police and TCU updates show "From {publisher} · Open source · issued · until" and a "not official" note above the list · Section 12: we copy from a source, we are not that source.

## Round 3: shared rate limits (C3)

- **2026-11-25** · Rate limits are counted in Postgres (`private.rate_limits`, fixed windows, one upsert per hit), not Redis · Nobody has created an Upstash account, and section 17 allows a Postgres fallback. It holds across every replica, and each hit is one small query.
- **2026-11-25** · The counter function sits in the `private` schema · Supabase's REST API only exposes `public`, so nobody can call it with the publishable key to fill someone else's bucket.
- **2026-11-25** · IP buckets hold an HMAC of the address, keyed with the Clerk secret key we already have · IPs are personal data. No new secret to manage; rotating the Clerk key only resets the counters.
- **2026-11-25** · If the counter fails, the request goes through and a warning is logged (fail open) · A broken counter shouldn't take the advisor down. Every write behind a limit needs the same database, so it fails anyway if the database is down.
- **2026-11-25** · Admin writes (official updates, road status) have no rate limit · Section 10 doesn't list one; they are role-gated and audited.
- **2026-11-25** · Onboarding and admin role changes share the "5 role attempts an hour per user" bucket · Section 10 names one limit for role attempts.

## Round 3: road reports (B2)

- **2026-11-25** · Trust rules (expiry per hazard, duplicates within 500 m / 60 min, confirmed by 2 verified people within 2 km / 3 h, 3 flags hide an unconfirmed report) live in `config/report-rules.json` and are passed to the database functions as one jsonb argument · One place to change them, versioned, and the SQL that applies them runs inside the same transaction as the write.
- **2026-11-25** · Expiry for "other" hazards is 3 hours, the same as accidents · Our own starting value; section 7 doesn't give one. It is marked as ours in the config file's note.
- **2026-11-25** · Dedupe, confirmations and flags run synchronously in SQL (`private.submit_report`, `confirm_report`, `flag_report`, with an advisory lock per hazard), not in a queue job · The answer ("merged into an earlier report") has to reach the driver straight away, and the lock stops two reports of the same rockfall from both being created.
- **2026-11-25** · The `Idempotency-Key` header becomes the report's `client_id` (unique per user) · A retry from a bad connection finds the same row and answers 200 "repeat", never a second report.
- **2026-11-25** · Photos are re-encoded at upload with sharp (rotated, at most 1600 px, WebP), which drops EXIF and GPS; no thumbnails · Re-encoding is the only reliable way to strip metadata, and the result is small enough to show as is.
- **2026-11-25** · Photos go to a private Storage bucket with the user's own Clerk token, and are shown through `/api/v1/reports/{id}/photo`, which reads the bytes and sends them (a redirect to a signed link would show the path, and the path holds the uploader's user id) · No secret key in app code; Storage policies check the report is visible, as RLS does for the row.
- **2026-11-25** · The queue (pgmq, worker, dead letters, B4) moves to slice 11 with Web Push · Nothing in B2 needs it now that photo cleaning is synchronous; its first real job is the push fan-out.
- **2026-11-25** · The corridor check is the section 6 box; the zone is taken from the nearest point on the NH-44 line · The box keeps far-away spam out; the nearest point gives the right zone without a new geometry table.
- **2026-11-25** · Flags share the confirmations rate-limit bucket (30 an hour per user) · Section 10 lists no limit for flags; both are one tap on a report.
- **2026-11-25** · The report screen is `/report/new` and needs sign-in; growers and traders see why they can't post · Section 10 roles. Confirm and flag buttons show to everyone on the map and explain a 401 or 403, so the public map doesn't call `/api/v1/me` on every load.

## Round 3: shipments and the agent board (D4)

- **2026-11-25** · Drivers join an agent with an 8-character invite code (no I, O, 0 or 1) that works once, for 1 to 30 days (7 by default) · A driver can't be added to a fleet without saying yes, and agents never see a list of all drivers. Codes are made in the database (`private.create_agent_invite`), at most 20 open per agent.
- **2026-11-25** · Joining, vouching, sharing a location and deleting an account are `private` SECURITY DEFINER functions that read the caller from the token · The REST API can't reach them, and each one checks the role and writes the audit row in the same transaction.
- **2026-11-25** · A database trigger refuses a `driver_id` that isn't one of the shipment agent's drivers · Column grants alone would let an agent assign any user id.
- **2026-11-25** · One active shipment per truck number (a partial unique index on rows that aren't delivered) · Two boards can't both claim the same truck on the road.
- **2026-11-25** · Saving a lot stores the advice of that moment (`decide()` output with `rules_version` and `risk_run_at`) · The board shows what we said then; asking again gives today's answer.
- **2026-11-25** · The driver's position is stored rounded to 2 decimals (about 1 km), only with `location_consent` on, and only for a shipment they are assigned to that isn't delivered · The agent needs the stretch of road, not the exact spot (DPDP data minimisation).
- **2026-11-25** · Live updates: Supabase Realtime on `shipments` with the user's own Clerk token, only as a "something changed" signal; the rows always come from `GET /api/v1/shipments` · RLS decides who gets which change, and the API stays the one place that shapes the data. Without Realtime the board reloads every minute.
- **2026-11-25** · The board gets its Realtime token from `GET /api/v1/me/realtime-token` and uses `@supabase/realtime-js` alone, not Clerk's browser library or the full supabase-js · It is the same short-lived token the browser already has in Clerk's cookie; the bundle stays small, and the bundle secret check stays strict (both libraries carry secret-key names in their code). `@supabase/realtime-js` is pinned to the version supabase-js uses.
- **2026-11-25** · Links to sign-in pages (`/board`, `/report/new`, `/me`) are plain `<a>` links (`SignInLink`) · Signed out, the server redirects to Clerk; an in-app fetch can't follow that under our CSP and logs an error.
- **2026-11-25** · The bundle secret check looks for key-shaped values and the real secret values, not variable names; the names are checked in our source instead (every reader is `server-only`) · Clerk's browser code (needed for the localised sign-in) lists `CLERK_SECRET_KEY` by name in a constants file, which made the name check fail on any Clerk component. No key value can reach the bundle without matching the new patterns.

## Round 3: sign-in, onboarding and your account (D2, slice 8)

- **2026-11-25** · Our own email-code sign-in page (`/sign-in`) built with Clerk's hooks (`useSignIn`, `useSignUp`); the same form signs in or creates the account · Section 8: every word comes from our messages files, so Urdu works (Clerk has no Urdu). `proxy.ts` sends signed-out visitors here with `signInUrl`.
- **2026-11-25** · After sign-in we go back only to a path on our own site (`safeRedirect`), otherwise to `/me` · `redirect_url` comes from the address bar, so it must not become an open redirect.
- **2026-11-25** · Our own "Sign out" button instead of Clerk's `<UserButton>` · The button's menu would be English only, and the only thing we need from it is signing out.
- **2026-11-25** · Clerk's browser library loads only on `/sign-in` and `/me` (`<ClerkProvider>` around those screens) · Other pages stay light; the board gets its token from our API.
- **2026-11-25** · Turning location sharing on stores the privacy notice version on the server (`PRIVACY_VERSION`); the client can't send one · The consent record must say which notice the person saw.
- **2026-11-25** · Deleting an account: the database first (row, audit entry, photo paths), then the photos, then the Clerk user · If anything after the database fails, the data is already gone and sending the request again finishes the job; a photo that can't be removed is logged, not a reason to keep the account.
- **2026-11-25** · Turning location sharing off deletes the last position at once, and a daily job clears it 7 days after delivery · The privacy page promised both; now the database does it.
- **2026-11-25** · The "copies these from the source" note shows only next to official updates, not on the board, sign-in or report screens · It is about copied police/TCU updates; the footer disclaimer is on every page.

## Round 3: offline (slice 9)

- **2026-11-25** · A hand-written service worker (`public/sw.js`), no Workbox or next-pwa · Section 13 asks for the policy to be readable at the top of the file; a plugin would hide it in generated code. Its rules are unit-tested by loading the file with a fake `self`.
- **2026-11-25** · The five public pages are cached although Next sends them as `private, no-store` · That header is Next's default for streamed pages; these pages show the same thing to everyone. Pages that need a sign-in are never cached; a test checks the worker's list against `protected-pages.ts`.
- **2026-11-25** · The worker's URL carries the deploy version (`/sw.js?v=…`) · A hand-written worker doesn't change between deploys, so without it the browser would never see an update or clear old build files.
- **2026-11-25** · Map tiles: only tiles touching the corridor box, at most 300 · Enough for the corridor at the zooms the map uses, without filling the phone. 300 is our choice, not a measured number.
- **2026-11-25** · Queued reports older than their hazard's expiry are dropped, not sent · They would leave the map the moment they arrived. The API has no "observed at" field yet, so a late report is dated when it arrives (docs/offline.md).
- **2026-11-25** · Report photos are shrunk on the phone to about 300 KB before sending, online or not · Section 13's target; it also helps on a weak signal. The server still checks and re-encodes every photo.
- **2026-11-25** · The outbox only sends reports as the person who wrote them, and sign-out wipes it · Two people can share a phone; a report must never be posted under someone else's name.


## Round 3: API docs and Postman (E2, slice 10)

- **2026-11-25** · OpenAPI 3.1 built with zod 4's own `z.toJSONSchema`, not `@asteasolutions/zod-to-openapi` · Our zod (4.6) writes JSON Schema 2020-12, which is what OpenAPI 3.1 uses; no extra package. The request schemas are the routes' own, so the document can't drift from what the API accepts.
- **2026-11-25** · One hand-written list of operations (`src/server/openapi/operations.ts`), checked by a test against every `route.ts`: method, path, access and rate limit must match, and every request example must pass the route's schema · Next has no route registry to generate from; the test makes a missing or wrong entry fail CI.
- **2026-11-25** · Example answers use made-up ids, names and times, and say so in the document; the zone and the past closure are real rows from the repo, and the advice example is what `decide()` answers · Section 6 wants examples for every status; "no invented numbers" means none may look like a real reading.
- **2026-11-25** · Swagger UI 5.34.1 copied from `swagger-ui-dist` into `public/vendor/` at build time and served by `/api/docs` · Section 6: our own files, not a CDN, so the CSP stays `'self'`. Pinned to a release more than two weeks old.
- **2026-11-25** · A bad query string is documented as 400 (with the field list), a bad body as 422 · That is what the API does (section 6: "400: malformed JSON or query"); Postman caught the first draft saying 422.
- **2026-11-25** · newman runs the two keyless Postman folders in CI against the Docker image; the signed-in and rate-limit folders run locally · CI has no database or Clerk keys by design. Nothing in the collection creates data: the 429 checks use invalid advice requests and wrong invite codes.

## Round 3: job queue (B4, slice 11a)

- **2026-11-25** · Supabase Queues (`pgmq`) in our own Postgres, no Redis or cloud queue · Section 17 asks for it; it is free, already ours, and needs no new Azure resource.
- **2026-11-25** · The job is added in the same transaction as the write (an "outbox"), not after it · A report saved without its job, or a job for a report that rolled back, can't happen.
- **2026-11-25** · Payloads carry ids only (`report_id`, `update_id`), at most 2 KB, and only three job names · The worker reads the row itself, so no personal data sits in the queue or the dead letters. The database refuses anything else.
- **2026-11-25** · The worker runs as its own database role, `routeguard_worker`, reached only after the `X-Jobs-Secret` check · It can read, finish and fail jobs and nothing else; a bug in the worker can't read users or reports it wasn't given rights to.
- **2026-11-25** · pg_cron wakes the worker every minute, but only when a job is due · The app scales to zero on Azure (section 4.1); calling it every minute regardless would keep a replica awake and spend credit. No GitHub Actions fallback for the same reason; the cron job is free.
- **2026-11-25** · 5 tries, then the dead letters; tries are 30 s, 60 s, 90 s, 120 s apart · Section 17 says "fail 5 times". A worker that dies mid-job counts as a try (the job comes back after 60 s).
- **2026-11-25** · Jobs may run twice, so every handler must be safe to repeat · `report.confirmed` is added for every new confirmation of a confirmed report (we don't know if it was already confirmed), and a worker can die after the work but before it says "done".
- **2026-11-25** · Until Web Push (B6) the handlers only log the event · The queue, retries, dead letters and wake-up are real and tested against the database; the push fan-out is the next slice.

## Round 3: Web Push alerts (B6, slice 11b)

- **2026-11-25** · `web-push` 4.0.0 for VAPID signing and payload encryption, no Firebase SDK · One small library for every browser's push service; Firebase would add a Google account and a client SDK. 4.0.0 is more than two weeks old and `npm audit` is clean.
- **2026-11-25** · Alerts only for confirmed reports and official updates, never for unconfirmed reports · One person's word shouldn't wake a driver at 3 am; section 9's confirmation rules decide what is trusted.
- **2026-11-25** · People pick the zones they follow; a whole-road update goes to everyone · A driver on the Banihal side doesn't need every Jammu alert. Zone matching is a Postgres array with a GIN index.
- **2026-11-25** · Each event is pushed once (`private.push_sent`), and a job is retried only when every send failed · Jobs may run twice; a partial failure (one browser timing out) shouldn't send everyone a second copy.
- **2026-11-25** · Endpoints limited to the known push services · The worker calls the endpoint, so an open URL field would let anyone point our server at any address (SSRF).
- **2026-11-25** · The alert's language is the one the browser had when alerts were turned on, and pressing Save again updates it · The worker runs with no request, so it can't read the cookie.
- **2026-11-25** · Signing out turns alerts off in that browser · Phones are shared; the next person shouldn't get the last person's alerts.
- **2026-11-25** · The VAPID public key is read on the server when `/me` is shown, not baked in as `NEXT_PUBLIC_` · The image is built without keys (CI); this way the same image works with whatever keys Azure has.


## Round 3: tests, performance and demo (slice 12)

- **2026-11-25** · Signed-in Playwright tests drive our own email-code sign-in screen with the seeded `+clerk_test` accounts and a Clerk testing token (`@clerk/testing`) · Tests the real screen people use. Rejected: Clerk's programmatic sign-in helper, which skips our screen. They write real rows, so they run only with `E2E_DB=1` and the seed clears them.
- **2026-11-25** · The demo seed asks the running app's `POST /api/v1/advice` for each truck's advice · The board shows advice the real code produced. Rejected: hand-written advice in the seed (invented numbers) and importing `decide()` into a script (needs a TypeScript loader for the `@/` paths).
- **2026-11-25** · MapLibre starts when the browser is idle (at most 1.5 s), and `<main>` is at least one screen tall · Lighthouse mobile on the map page went from 27 to 79 (TBT 2,050 → 130 ms, CLS 0.6 → 0). Rejected: loading the map only on tap, which hides the main feature.
- **2026-11-25** · One GitHub issue per work package, made after the code, unassigned, each saying who built it and linking its pull requests · Aryaveer asked for them to track the packages. Assigning finished tasks to members who didn't do them would misstate who did what, so the issues name the plan's owner and the real builder separately.

## Round 3: hexes, map labels and Aadhaar QR (slice 13)

- **2026-11-25** · Earlier today we cut C5, C6 and the Aadhaar check; Aryaveer asked for all three as our differentiator, so they are back in · They are what sets RouteGuard apart in the demo.
- **2026-11-25** · H3 cells at resolution 8 (about 0.8 km² each here; 0.74 km² is the world average), only the cells the OSM driving line passes through (291) · Small enough to tell a gorge stretch from a flat one, few enough to score hourly and send to a phone (one request, cached per run). Rejected: resolution 9 (779 cells along the same line for little gain at weather-point scale) and a buffer of neighbouring cells (the hazard is to the road).
- **2026-11-25** · Slope per cell = the steepest slope from the cell centre to its six corners, from Open-Meteo's elevation API (Copernicus DEM GLO-90) · Free, no key, the provider we already use. The road itself is often flat; the hillside above it is what fails. Rejected: slope at the road point only, which said gorge roads were gentle.
- **2026-11-25** · The server sends each cell's outline (h3-js on the server) · The phone doesn't download the H3 library (hundreds of KB).
- **2026-11-25** · Hindi and Urdu town names are drawn as page text over the map, and the base map's own labels are hidden in those languages · MapLibre draws text with its own glyphs: it can't build Devanagari conjuncts or join Urdu letters without an extra plugin loaded from outside. The browser shapes page text correctly. Rejected: the base map's `name:hi` labels (broken shaping) and the RTL plugin (another third-party script in our CSP).
- **2026-11-25** · The blank band across the top of the map in our screenshots came from headless Chromium's software WebGL at the Pixel 5's 2.75 pixel ratio, not from the app · A real browser and headless Chromium with the GPU (`--use-angle=metal`) draw the whole map; the screenshot script uses the GPU now.
- **2026-11-25** · Aadhaar Secure QR is checked on our server against certificates pinned in the repo with fingerprints; the phone only reads the QR · The signature check needs UIDAI's public key and must not be skippable by a changed phone app. Pinning (not downloading at run time) means a swapped certificate shows up in a pull request.
- **2026-11-25** · Only the verdict, the last 4 digits and the consent and certificate versions are stored · BUILD_PROMPT section 11 and the DPDP Act's data minimisation. The name is compared in memory and dropped.
- **2026-11-25** · Name match: identical after normalising → verified; another word order or one typo → manual review; else rejected · A loose match would let someone use another person's card; an exact-only match would turn away people who typed their name slightly differently. Manual review raises nothing.
- **2026-11-25** · A demo key made by `scripts/aadhaar/make-demo-qr.mjs`, accepted only with `AADHAAR_ALLOW_TEST_CERT=true`, and shown as "Demo check (test key)" · No real Aadhaar card may be scanned on stage or in tests. The private key was never saved, so nobody can sign more demo codes.
- **2026-11-25** · QR from the camera or from a picture chosen on the phone, decoded on the phone (`BarcodeDetector`, `jsQR` fallback) · e-Aadhaar is a PDF on many phones; a screenshot of it works. The picture never leaves the phone.
- **2026-11-25** · Pinned UIDAI's current offline e-KYC / Secure QR certificate (valid to Feb 2029) and the one before it (expired Feb 2026) · UIDAI's page says these validate the Secure QR Code; cards and e-Aadhaar PDFs made before Feb 2026 carry signatures from the older key, which were valid when made. Rejected: checking expiry at scan time, which would turn away every older card. The two certificates in the page's separate "Secure QR Code" table expired in 2020–21 and are not pinned.

## Round 3: live map (D4b)

- **2026-11-25** · New reports and official updates reach open maps through a Realtime broadcast with no data on the public topic `map`, sent by a statement trigger; the map then reloads both lists from our API · Same pattern as the agent board: the API stays the one place that decides what is public (no user ids, no hidden reports). A broadcast needs no sign-in, so signed-out visitors get it too, and it carries nothing to leak.
- **2026-11-25** · The signal can never fail a write (errors in the trigger are swallowed), and the map also reloads every minute while it is on screen · The signal is a hint. Expired reports leave the map without any write, so the minute reload is still needed.
- **2026-11-25** · A reload after a signal skips the browser's HTTP cache (`cache: "no-cache"`) · `GET /api/v1/reports` allows a 30 s cached copy, which would hide the report the signal was about.


## Round 3: who can post reports (slice 14)

- **2026-11-26** · Drivers post road reports only once verified: vouched by their agent or through the optional Aadhaar QR check · A driver's report goes on the map at once, so it must come from someone accountable; judges asked how we stop fake reports. Checked in the API (403 before the photo is read) and again in `private.submit_report()`. Rejected: compulsory Aadhaar (the 2018 Puttaswamy judgment; we aren't a UIDAI-registered verifier; a photo of someone else's card passes), and leaving drivers open with only confirmations (spam still reaches the map as dashed pins).
- **2026-11-26** · Agents can still post without being verified, and their reports wait for confirmation · An agent signs up a fleet and is known to their drivers; blocking them too would leave no one to report before the first vouch.

## Team change (26 Nov 2026)

- **2026-11-26** · One member left the team, so WP-E is split: Navaya owns the advice engine (`decide.ts`, `POST /api/v1/advice`) and presents demo step 4, Madhusudan owns the OpenAPI document, Swagger and Postman, Aryaveer owns the demo seed, demo script, README and load test · Each piece goes to the member whose area it touches: advice uses Navaya's priority module and risk read path; Postman tests the APIs Madhusudan's reports and updates live in. Issues #69 and #70 went to Madhusudan and Riya.

## TCU approves every account (26 Nov 2026)

- **2026-11-26** · TCU (J&K Traffic Police Traffic Control Unit) is the only admin; the police role is merged into it · One staff role is easier to explain and to audit. The app can't give `admin` or `police`; old police accounts are kept but rejected, with no role.
- **2026-11-26** · Every new account (grower, trader, agent, driver) waits for TCU's approval · Only people TCU has checked can post reports or run a fleet. The map, the 48 h strip and the advisor stay open to everyone without an account.
- **2026-11-26** · Approval is a gate in front of the existing checks, not a replacement · A driver still needs an agent's vouch or the Aadhaar check to post reports.
- **2026-11-26** · The role reaches Clerk only on approval, and `private.jwt_role()` also checks the `users` row · Two locks: a pending account has no role in its token, and even a token with a role counts for nothing in the database unless the row is approved and matches.
- **2026-11-26** · TCU sees the waiting person's email (from Clerk, not stored by us), name and requested role · TCU needs to know who is asking. The privacy notice says so (version 2026-11-26).

## Consistency pass before the demo (26 Nov 2026)

- **2026-11-26** · Every place that still let "police" through (official updates, reports, confirmations, the report page, OpenAPI) now says TCU (admin) only. `police` stays only where it protects old tokens (`caller.ts`, `private.jwt_role`) and in the SQL enums and policies · Since the merge, a police token already counted as no role, so behaviour doesn't change; the code and docs now say what it does. Changing the SQL would need a migration for no change. The full list is `docs/round3/consistency.md`.
- **2026-11-26** · `/admin/audit` names every action the database writes, in all three languages (approvals, rejections, account deletes, a driver joining an agent, vouching, Aadhaar checks) · Raw names like `driver.vouched` look unfinished on the screen judges will open.
- **2026-11-26** · The seed gives the demo official updates a noted 36 h demo window (`DEMO_WINDOW_HOURS`) and writes an `official_update.created` audit row for each, with a reason naming the seed · The sources are past news reports with no validity of their own, so any window is ours; it is written down in the seed. The old 12 h window expired overnight. The audit row makes `/admin/audit` match what the map shows, and says it came from the seed, not the console.
- **2026-11-26** · Demo reports keep the real expiry rules; we seed within 2 hours of presenting instead · Stretching a report's life for the demo would show the map breaking its own rule.
- **2026-11-26** · `scripts/demo-check.mjs` checks demo readiness with GET requests only (the public API, Clerk's user list and the `users` table) · A check run minutes before presenting must not change anything it checks. Account checks are SKIP without keys, so anyone can run the public part.
- **2026-11-26** · Lint leaves out the two frozen Round 2 files (`docs/ux/figma-plugin/code.js`, `scripts/round2/web/shared.js`) · They are what Round 2 handed in, not part of the app; their 20 warnings hid real ones. `npm run lint` now reports 0.
- **2026-11-26** · One Playwright test walks the whole offline story (saved map, advice on the phone, a queued report sent exactly once), and skips itself where no service worker runs (`next dev`) · The pieces were tested apart; the demo shows them together. The worker only registers in production builds, so the test says why it skipped instead of failing. The real-phone check stays with Riya (issue #78).
- **2026-11-26** · Deploy readiness checked without deploying: the production standalone server, started with no secrets and no env files, answers `/api/v1/health` 200 and passes `scripts/smoke.mjs` (ready and risk give an allowed 503 with no database). There is no Docker on the laptop, so the image itself is built and smoke-tested by CI's Docker job on every PR · Same `server.js` the image runs. The runbook gained a step for the demo's extra settings (job worker, push, Aadhaar demo flags) and the demo-check after deploy.

## Before the final demo: small additions (26 Nov 2026)

- **2026-11-26** · Read aloud on the advisor (improves Round 1 feature 4, the dispatch advisor) uses the browser's own `speechSynthesis` and only a voice for the screen's language; with none, the button is hidden · Drivers read the answer at a loading point or in a cab. An English voice reading Hindi or Urdu text is nonsense, so no voice is better than the wrong one. It reads exactly the lines on screen, including "advice only". No server, no cost, works offline with the phone's voices. Rejected: a cloud text-to-speech service (costs money, needs a signal, sends the text away).
- **2026-11-26** · "What would change the answer" (improves Round 1 feature 4, the dispatch advisor) re-runs the same `decide()` on the phone with days since picking up to 7 days either way, and the other truck type; it shows at most two lines and only when the decision really flips · An explanation that comes from the same rules can't drift from them. Tonnes is left out because it never changes the decision, only the priority. Values stay inside the form's ranges (0–120 days). The lines are hidden when the phone's saved scores would give a different answer from the one on screen, so they never contradict it. Rejected: an API change, and hints we can't back with the rules (like "wait 6 hours").
- **2026-11-26** · A Share button on the 48 h strip (improves Round 1 feature 7, offline mode's text summary under 5 KB) sends the existing `GET /api/v1/risk/summary` text plus a link to `/strip`, with `navigator.share` and the clipboard as the fallback · Drivers pass road news on WhatsApp; the summary was only reachable by typing the API address. It reuses the summary the service worker already keeps, so it works offline, and the API response doesn't change (the link is added on the phone). A test checks the worst case (every zone high at every time) stays under 5 KB in all three languages. Closing the share sheet does nothing more; only a refused share falls back to copying.
- **2026-11-26** · `/board` marks a truck whose current or next zone is high now or within 12 h (improves Round 1 feature 6, the shipment board) · An agent with several trucks sees which to call first. The current zone comes from the last shared position (within 5 km of NH-44, else unknown); the next zone is the next one towards Jammu on that destination's route; a truck not yet seen on the road gets its route's first zone. Delivered, on rail and diverted trucks get no mark. When the scores are missing, no mark: we can't say the road is clear, and a "clear" badge would be a claim we can't back. The mark says "advice only, check with TCU" and changes nothing about the shipment. Rejected: a server-side flag (an API change for something the phone can work out from public scores).
- **2026-11-26** · "Play the storm" in replay mode (improves Round 1 feature 2, the 48-hour strip, as shown on feature 1, the risk map) steps now → +12 → +24 → +48 h at 2 s a step and stops at +48 · Judges see the warning build up over 48 hours in under 10 seconds without us tapping four buttons. It only moves the existing step buttons, so the banner, the data and the live map don't change; tapping a step or leaving the replay stops it. With `prefers-reduced-motion` the button isn't shown (and the page assumes reduced motion until the browser says otherwise), so nothing moves by itself. Rejected: smooth tweening between steps (scores exist only at the four times; anything in between would be made up).
- **2026-11-26** · A `/backtest` page (improves Round 1 feature 1, the live risk map: how far to trust its colours), linked from the map as "How this works", reads `lib/risk/backtest.json` at build time; a pytest checks that file renders to exactly the committed `docs/backtest.md` · Judges asked how good the score is; the answer was only in a Markdown file. Both files come from one run of `jobs/backtest.py`, so the page can't show a number the doc doesn't. The page states the small sample (27 verified incidents) and that false alarms are an upper bound. We didn't re-run the backtest: same data, same numbers. Rejected: an API endpoint for it (the numbers change only when someone re-runs the script and commits).
- **2026-11-26** · A read-only Playwright walk opens the demo script's screens as each demo account and fails on any console error or failed `/api/v1` call · Route tests fake the database, so a query that is valid TypeScript but wrong SQL passes them. The walk found exactly that on `/admin/reports` (fixed in #98, with a test on the generated SQL). It submits nothing, so it is safe to run before presenting.

