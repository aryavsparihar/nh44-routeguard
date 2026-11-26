# Demo script (5 minutes)

One phone (or Chrome DevTools in a phone size) on the projector, one laptop with Postman and Swagger. Before we start: see the checklist at the end.

| # | Who | Time | What we show | What to say |
| --- | --- | --- | --- | --- |
| 1 | Aryaveer | 20 s | Home screen | Apples leave Kashmir on one road, NH-44. When it closes, trucks sit for days and fruit spoils. The warning usually comes too late. RouteGuard gives a 48-hour risk forecast and a dispatch advice. |
| 2 | Riya | 40 s | Language switch: اردو → हिन्दी → English | The whole app is in Urdu, Hindi and English. Urdu is right-to-left, numbers and "+48 h" stay readable. The footer on every screen says we are not an official police service. |
| 3 | Navaya | 45 s | Map, then `/strip` (48 h strip); DevTools Network on `/api/v1/risk` | Each zone has a score, a reason and a confidence. Risk is computed once an hour for everyone, not per request. Reload: the request answers **304** with no body because the ETag matches. If today is calm and every zone is low, say so ("the weather is calm, so the honest score is 0") and tap **Show a past storm**: the 23 Jan 2026 snow day scored by the same rules, with its news source. |
| 4 | Navaya | 45 s | `/advisor`: Kullu Delicious, 10 days, 12 t, Azadpur, heavy → answer. Same body in Swagger (`/api/docs`, `POST /api/v1/advice`). Then airplane mode → ask again | The phone calls our API; Swagger gives the same answer. Offline, the same `decide()` runs on the phone from the saved scores, and the screen says so. |
| 5 | Madhusudan | 60 s | Demo driver (vouched): `/report/new` offline → queued. Back online → syncs and goes live (solid). TCU taps "I see it too" on the agent's unconfirmed slide near Peerah (dashed) → solid. TCU posts an official update with its source; `/admin/audit` shows both entries. | Only verified drivers can post: their agent vouched for them, or they did the Aadhaar check. Agents' reports wait for two confirmations or TCU. Official updates always carry their source. Every TCU action is in an audit log nobody can edit. |
| 6 | Aryaveer | 45 s | Joining: the waiting driver on the phone, `/me` → "Waiting for TCU". TCU on the laptop, `/admin/approvals` → Approve. Then demo driver (not vouched) on the phone: `/report/new` → "First, get verified". `/me` → "Aadhaar QR check" → tick consent → scan `docs/demo/aadhaar-demo-qr.png` shown on the laptop → "Demo check (test key)", level "Aadhaar checked" → `/report/new` now opens | TCU approves every new account; until then it has no role anywhere. Aadhaar is optional, never required. The phone reads the QR; our server checks UIDAI's signature against a pinned certificate and the name. We keep only the result and the last 4 digits. This QR is signed with our own demo key, never a real card. |
| 7 | Aryaveer | 30 s | Postman: folder 2 (401s), folder 3 (403 grower posting an update, 422 bad truck number, 429), then `npm run db:test` output | Every error is problem+json with a request id. Row Level Security checks again in the database, so a route that forgot a check still can't leak data. |
| 8 | Navaya / Madhusudan | 15 s | `docs/scaling.md` table; `/admin/jobs` | Cached reads: p50 3 ms locally. Writes go through a queue in Postgres; failed jobs land in a dead-letter list. Container Apps scales 0 → 3 replicas. |
| 9 | Everyone | 15 s | — | One limitation each (below). |

## Limitations (one each)

- Aryaveer: Clerk runs as a development instance; GPS can be spoofed.
- Riya: translations were checked by team members, not professional translators.
- Navaya: the thresholds are starting values, not fitted to data; no read replicas, one database.
- Madhusudan: the incident history is small and incomplete, so the backtest is weak evidence.

## Before we present

1. `node scripts/seed-demo.mts` (Aryaveer's machine, app running) **within 2 hours of presenting**. Demo reports keep the real expiry rules (`config/report-rules.json`: 6 h for the rockfall and landslide), counted from seed time. The two demo official updates stay in force for 36 h (`DEMO_WINDOW_HOURS`), each with an audit entry. Run it again after any signed-in Playwright run: the Aadhaar test leaves driver2 checked.
2. `node scripts/demo-check.mjs <url>` (the live URL, or `http://localhost:3000`) a few minutes before. It also warms a replica (min replicas is 0). Every line must say PASS: health, fresh risk data, an official update in force, a confirmed and an unconfirmed demo report, the storm replays, and each demo account's role and approval. It only reads; it never writes or prints a key.
3. Check `/api/v1/health/ready` says `stale: false`. If stale, run the risk job by hand (`risk-job.yml`, "Run workflow").
4. Sign in on the phone as the demo driver; sign in on the laptop as the admin. Code for all demo accounts: `424242`.
5. Postman: environment "local" or "live" with fresh tokens (postman/README.md).
6. Airplane mode tested once on the real phone after loading the advisor.
7. Aadhaar: the app has `FEATURE_AADHAAR_QR=true` and `AADHAAR_ALLOW_TEST_CERT=true` for the demo (blank it again afterwards); the seed (step 1) has reset the demo driver; `docs/demo/aadhaar-demo-qr.png` is open full screen on the laptop.
8. Look at the map: if every zone is low, Navaya opens a past storm in step 3. Never edit scores to look busy.
9. Fallback: if the network fails, run `npm run build && npm start` on the laptop and show `localhost:3000`.
