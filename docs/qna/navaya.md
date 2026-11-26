
# Navaya: Map, Risk Read Path, Priority Scoring & Advice Engine (WP-C)

## What I Own

My responsibilities cover the map and zone screens (`src/ui/risk/`), the risk read API (`src/server/risk/`, `app/api/v1/risk/`, `/zones`, `/risk/summary`), the shared rate-limit store (`src/server/http/rate-limit*.ts`, `private.rate_limits`), the priority module (`src/shared/priority.ts`, `config/advice-assumptions.json`), the advice engine, and the read-path section of `docs/scaling.md`.

## Risk API: Request Flow

A typical request:

`GET /api/v1/risk?zone=4&horizon=24`

- Zod validates the query parameters and rejects invalid input with HTTP 400. Previously, `?zone=abc` returned everything (live-app bug L7).
- The request uses the 60-second memory cache or executes one Drizzle query on `latest_risk`.
- The response includes an ETag based on the run time.
- Cache headers: `Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=3300`.
- A repeated request with a matching `If-None-Match` header returns HTTP 304 without a response body.

**Tests:** `src/server/risk/risk.routes.test.ts` verifies the 304 response for a matching ETag and the 400 response for invalid query input.

## Shared Rate-Limit Store

Rate limits are stored in PostgreSQL using upserts and fixed windows, ensuring that limits are maintained across replicas.

**Alternatives rejected:**
- In-memory limits: Each replica would independently allow its own 60 requests.
- Upstash Redis: Introduces another account to manage, while Section 17 allows the PostgreSQL fallback.

## Priority Module

Implemented in `src/shared/priority.ts`, with assumptions configured in `config/advice-assumptions.json`.

The thresholds (0.30 / 0.65) and priority assumptions are initial values, not values fitted to actual data.

**Limitation and planned fix:** These assumptions will be tuned against the backtest once more verified incidents are available.

## Performance Measurements

Documented in `docs/scaling.md`.

Measured on a laptop on 25 November 2026:
- Warm p50: 3 ms.
- 304 p50: 2 ms.

## H3 Corridor Cells (C5)

**Data pipeline:**

`jobs/tools/build_hexes.py` → `data/corridor_hexes.csv` + `data/hex_slope.csv` → `jobs/load_hexes.py` → hourly scoring job → `GET /api/v1/risk/hexes`

- The hourly job scores 291 cells.
- Hexagonal outlines are generated using `h3-js` on the server.
- The resulting fill layer is displayed beneath the corridor line.

**Test:** `src/server/risk/hexes.routes.test.ts` checks closed outlines, 304 responses and 400 responses.

## Map Labels (C6)

For Hindi and Urdu, `RiskMap.tsx` hides the base map labels and renders town names from `src/shared/map-places.ts` as page text.

This approach is used because MapLibre cannot properly shape Devanagari or join Urdu letters.

## Advice Engine

**Ownership added: 26 November 2026.**

Implemented in `src/shared/decide.ts` and `POST /api/v1/advice` (`src/server/advice/`).

**Request inputs:**

`{variety, days_since_picking, tonnes, destination, truck_type}`

**Request flow:**

1. `withApi()` handles the request.
2. The endpoint is public, with a limit of 60 requests per minute per IP.
3. Strict Zod validation checks the request body.
4. The system retrieves the newest risk rows for the zones along the route.
5. Administrator-set Mughal Road and rail statuses are also considered.
6. `decide()` processes the inputs and returns a recommendation.

**Possible outputs:**
- `SEND`
- `HOLD`
- `RAIL`
- `DIVERT`

Each response includes a `reason_code`, a priority band from `priority.ts`, and supporting notes, such as `"Mughal Road status unknown"`. The phone translates the reason.

**Offline functionality:**

When offline, the phone runs the same `decide()` function using its saved risk scores.

**Tests:**

- `src/server/advice/advice.routes.test.ts` supplies the same inputs to the API and `decide()` and verifies that both return the same answer.
- `decide.test.ts` covers every decision outcome and the edge cases.

This ensures that online and offline advice do not disagree.

