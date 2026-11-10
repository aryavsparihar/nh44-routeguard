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
