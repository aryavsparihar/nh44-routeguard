# Demo script (5 minutes)

One phone (or Chrome DevTools in a phone size) on the projector, one laptop with Postman and Swagger. Before we start: see the checklist at the end.

| # | Who | Time | What we show | What to say |
| --- | --- | --- | --- | --- |
| 1 | Aryaveer | 20 s | Home screen | Apples leave Kashmir on one road, NH-44. When it closes, trucks sit for days and fruit spoils. The warning usually comes too late. RouteGuard gives a 48-hour risk forecast and a dispatch advice. |
| 2 | Riya | 40 s | Language switch: اردو → हिन्दी → English | The whole app is in Urdu, Hindi and English. Urdu is right-to-left, numbers and "+48 h" stay readable. The footer on every screen says we are not an official police service. |
| 3 | Navaya | 45 s | Map, then `/strip` (48 h strip); DevTools Network on `/api/v1/risk` | Each zone has a score, a reason and a confidence. Risk is computed once an hour for everyone, not per request. Reload: the request answers **304** with no body because the ETag matches. |
| 4 | Mayank | 45 s | `/advisor`: Kullu Delicious, 10 days, 12 t, Azadpur, heavy → answer. Same body in Swagger (`/api/docs`, `POST /api/v1/advice`). Then airplane mode → ask again | The phone calls our API; Swagger gives the same answer. Offline, the same `decide()` runs on the phone from the saved scores, and the screen says so. |
| 5 | Madhusudan | 60 s | Demo driver (vouched): `/report/new` offline → queued. Back online → syncs and goes live (solid). Police taps "I see it too" on the agent's unconfirmed slide near Peerah (dashed) → solid. Admin posts an official update with its source; `/admin/audit` shows both entries. | Only verified drivers can post: their agent vouched for them, or they did the Aadhaar check. Agents' reports wait for two confirmations or police. Official updates always carry their source. Every admin and police action is in an audit log nobody can edit. |
| 6 | Aryaveer | 30 s | Demo driver (not vouched) on the phone: `/report/new` → "First, get verified". `/me` → "Aadhaar QR check" → tick consent → scan `docs/demo/aadhaar-demo-qr.png` shown on the laptop → "Demo check (test key)", level "Aadhaar checked" → `/report/new` now opens | Optional, never required. The phone reads the QR; our server checks UIDAI's signature against a pinned certificate and the name. We keep only the result and the last 4 digits. This QR is signed with our own demo key, never a real card. |
| 7 | Aryaveer | 30 s | Postman: folder 2 (401s), folder 3 (403 grower posting an update, 422 bad truck number, 429), then `npm run db:test` output | Every error is problem+json with a request id. Row Level Security checks again in the database, so a route that forgot a check still can't leak data. |
| 8 | Navaya / Madhusudan | 15 s | `docs/scaling.md` table; `/admin/jobs` | Cached reads: p50 3 ms locally. Writes go through a queue in Postgres; failed jobs land in a dead-letter list. Container Apps scales 0 → 3 replicas. |
| 9 | Everyone | 15 s | — | One limitation each (below). |

## Limitations (one each)

- Aryaveer: Clerk runs as a development instance; GPS can be spoofed.
- Riya: translations were checked by team members, not professional translators.
- Navaya: the thresholds are starting values, not fitted to data.
- Mayank: the incident history is small and incomplete, so the backtest is weak evidence.
- Madhusudan: no read replicas; one database.

## Before we present

1. `node scripts/seed-demo.mts` (Aryaveer's machine, app running) so the board, reports and updates are fresh.
2. Open the live URL and call `/api/v1/health/ready` a few minutes before, so a replica is warm (min replicas is 0).
3. Check `/api/v1/health/ready` says `stale: false`. If stale, run the risk job by hand (`risk-job.yml`, "Run workflow").
4. Sign in on the phone as the demo driver; sign in on the laptop as the admin. Code for all demo accounts: `424242`.
5. Postman: environment "local" or "live" with fresh tokens (postman/README.md).
6. Airplane mode tested once on the real phone after loading the advisor.
7. Aadhaar: the app has `FEATURE_AADHAAR_QR=true` and `AADHAAR_ALLOW_TEST_CERT=true` for the demo (blank it again afterwards); the seed (step 1) has reset the demo driver; `docs/demo/aadhaar-demo-qr.png` is open full screen on the laptop.
8. Fallback: if the network fails, run `npm run build && npm start` on the laptop and show `localhost:3000`.
