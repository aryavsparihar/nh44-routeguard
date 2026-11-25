# Navaya: map, risk read path, priority score (WP-C)

**What I own:** the map and zone screens (`src/ui/risk/`), the risk read API (`src/server/risk/`, `app/api/v1/risk/`, `/zones`, `/risk/summary`), the shared rate-limit store (`src/server/http/rate-limit*.ts`, `private.rate_limits`), the priority module (`src/shared/priority.ts`, `config/advice-assumptions.json`) and the read-path part of `docs/scaling.md`.

**A request I can trace:** `GET /api/v1/risk?zone=4&horizon=24` → zod rejects bad input with 400 (`?zone=abc` used to return everything: live-app bug L7) → the 60 s memory cache, or one Drizzle query on `latest_risk` → response with `ETag` = the run time and `Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=3300` → a repeat request with `If-None-Match` gets 304 with no body.

**A test and what it proves:** `src/server/risk/risk.routes.test.ts` checks the 304 on a matching ETag and the 400 on bad query input. `e2e/mobile.spec.ts` checks no page scrolls sideways at 360 px (bug L1).

**A decision and what we rejected:** rate limits counted in Postgres (one upsert per hit, fixed windows) so they hold across replicas. Rejected: in-memory limits (each replica would allow its own 60) and Upstash Redis (another account to manage; section 17 allows the Postgres fallback).

**A limitation and the fix:** the thresholds (0.30 / 0.65) and priority assumptions are starting values, not fitted to data. Fix: tune them against the backtest once we have more verified incidents. Also, map place names stay in English: we'd need a base map with Hindi and Urdu labels.

Measured: `docs/scaling.md` (warm p50 3 ms, 304 p50 2 ms, on a laptop, 25 Nov 2026).
