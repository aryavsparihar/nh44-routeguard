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
- **2026-11-10** · Store `level` (low/medium/high) in `risk_scores` · Mayank's advice table reads it directly, so the app doesn't need its own copy of the cut-offs.
- **2026-11-10** · `latest_risk` view with `security_invoker = true` · The view follows the caller's RLS instead of bypassing it.
- **2026-11-10** · `--dry-run` reads nothing from the database · Teammates can run it with no key at all. Confidence then falls back to exposure.
- **2026-11-10** · After each hourly run, `check_run.py` checks for 24 fresh zone rows · A run that "succeeds" but writes nothing still turns red.

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
