# Mayank: advice engine, API docs, tests, demo (WP-E)

**What I own:** `src/shared/decide.ts` and `POST /api/v1/advice` (`src/server/advice/`), the OpenAPI document and Swagger UI (`src/server/openapi/`, `/api/docs`), the Postman collection (`postman/`), the load script (`scripts/load/risk.mjs`), the demo seed (`scripts/seed-demo.mts`), `docs/demo-script.md`, `docs/qna/README.md` and the README assembly.

**A request I can trace:** `POST /api/v1/advice` with `{variety, days_since_picking, tonnes, destination, truck_type}` → `withApi()`: public, 60 a minute per IP, strict zod body → the newest risk rows for the zones on the route and the admin-set Mughal Road / rail status → `decide()` returns SEND, HOLD, RAIL or DIVERT with a `reason_code`, a priority band and notes such as "Mughal Road status unknown" → the phone translates the reason. Offline, the phone runs the same `decide()` on its saved scores.

**A test and what it proves:** `src/shared/decide.test.ts` is table-driven over every answer and the edges, including Mughal Road and rail unknown. `src/server/advice/advice.routes.test.ts` feeds the same inputs to the API and to `decide()` and expects the same answer, so online and offline advice never disagree.

**A decision and what we rejected:** the OpenAPI document is generated from the routes' own zod schemas, and `openapi.test.ts` fails if a route is missing. Rejected: a hand-written YAML file, which drifts from the code.

**A limitation and the fix:** the spoilage and value assumptions behind the priority band are our starting values (`config/advice-assumptions.json`, with notes). Fix: replace them with figures from growers and mandi records.

Demo seed: `node scripts/seed-demo.mts` (accounts sign in with code 424242), `--reset` to remove the demo rows.
