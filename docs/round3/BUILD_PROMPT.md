# RouteGuard: Round 3 build prompt (for Claude Code)

Repo: `aryavsparihar/nh44-routeguard` · Team 01 · Round 3 (backend and pre-deployment) on 26–27 Nov 2026
Written 24 Nov 2026. Keep this file at `docs/round3/BUILD_PROMPT.md`. The Clerk setup prompt sits next to it as `docs/round3/clerk-setup.md`.

---

## How the team uses this file (humans read this part)

1. Aryaveer commits this file and `clerk-setup.md` to `docs/round3/` on a branch, opens a PR, merges it.
2. Every member runs Claude Code **on their own laptop, logged in to their own GitHub account**, in their own clone. Nobody commits for anyone else.
3. Each person starts Claude Code with the kickoff message for their work package (Appendix A). Claude reads sections 0–3 plus the sections its package points to.
4. Step 0 (section 4) goes first. Nobody changes app code until the demo app's code is in the repo.
5. P0 means we lose marks without it. P1 means do it only once all your P0 work is merged. P2 means after the round. If time is short, cut P1 without arguing about it.

---

## 0. Read this first (Claude)

You are helping one member of Team 01 build RouteGuard for a judged hackathon round. The judges read the repo, use the live app, test the API, and ask **any member** to open the code and explain it. So:

- Write code a second-year student can explain line by line. Plain names, short functions, comments only where the reason isn't obvious. No clever abstractions.
- Before you write code, read: `AGENTS.md`, `README.md`, `docs/decisions.md`, `docs/risk-model.md`, `supabase/migrations/`, and the sections of this file your work package lists.
- This is Next.js 16. Read the relevant guide in `node_modules/next/dist/docs/` before you use any Next API (`proxy.ts` replaced `middleware.ts`, `params` and `auth()` are async). Do not upgrade Next, React, Clerk or Supabase packages this week.
- If you are not sure how a library works in the installed version, check its current docs (Context7 MCP if you have it, otherwise the official docs) before writing code. Don't guess an API.
- Start every work package in **plan mode**: show the plan (files you'll touch, migrations, tests, commits) and wait for the member to say yes.
- Work on a branch named `<firstname>/<topic>`. Small commits. Open a PR when a slice works. Section 20 has the commit rules.
- At the end of each work package, write `docs/qna/<firstname>.md` (format in section 23) and then ask the member five questions about the code you wrote together. Don't move on until they can answer. Judges will ask them, not you.

### Stop and ask the member before you:
- run any migration against the real Supabase project, or change a column type, or drop anything;
- switch Clerk application, replace keys, or create a Clerk app (`clerk-setup.md` has the rules);
- read, print, copy or edit any `.env*` file other than `.env.example`;
- delete data, force-push, rewrite history, or merge to `main`;
- deploy to the live URL;
- touch real personal data (phone numbers, Aadhaar, location history) in any form.

---

## 1. Where we are (24 Nov 2026)

### 1.1 What the judges score

| # | Section | Marks | What they check |
|---|---|---|---|
| 1 | Working backend and core flow | 25 for 1 and 2 together (the photo of the score sheet cuts off the split) | Correct methods, status codes, responses; frontend uses the real backend, no mocked data; main flow doesn't crash |
| 2 | Architecture and code structure | (see above) | Routes, controllers, services, models kept apart; sensible tech choices |
| 3 | Database and data handling | 10 | Validation, edge cases, meaningful seed data judges can test with |
| 4 | Reliability | 10 | Secrets in env vars, error handling, logging |
| 5 | Testing and performance | 10 | Unit/integration tests or Postman/Swagger; response times |
| 6 | Innovation and problem fit | 10 | Solves the problem; smart decisions beyond basics (AI or real-time) |
| 7 | Live demo and Q&A | 15 | Working demo; members explain their own code |
| 8 | Security and guardrails | 10 | Login, roles, protected routes, input validation, SQL injection and XSS protection, bad requests rejected cleanly |
| 9 | Roles and contributions | 10 | Commit history, tasks owned, every member explains their part |
| Bonus | Scaling design implemented and explained | +5 | Caching, load balancing, queues, horizontal scaling, replication |
| Bonus | 50+ commits | +5 | Commit history |
| Penalty | Project changed more than 10–15% from the Round 1 PPT | −5 | |
| Penalty | Absent members | −5 each (−15 once if under half) | All four must be there |

Must submit: GitHub repo with backend and frontend, live link (or local demo), Postman collection or Swagger/OpenAPI page, `.env` sample with no secrets committed. The bottom six teams are eliminated after this round.

In the live evaluation every member must be able to explain: the problem and target user; one request traced end to end through frontend, backend and database; how login, roles and input checks work; our API responses and error handling; their own code; one limitation and how they'd fix it.

### 1.2 What we promised in Round 1 (the baseline, don't drift from it)

The 7 MVP features from the submitted PPT (slide 6):
1. Live risk map: H3 cells coloured by risk, tap for reason and confidence
2. 48-hour strip per zone: now, +12, +24, +48 h
3. Hazard layer: landslide, rockfall, flash flood, snow/ice
4. Dispatch advisor with priority score (spoilage × load value): send, hold, rail or divert
5. Verified driver and police reports: photo, GPS, expiry
6. Shipment board for transport agents: last seen, ETA, delay
7. Offline mode: cached scores, queued reports, text summary under 5 KB

Also promised:
- Roles grower, trader, agent, driver, police, admin.
- Drivers are verified through their transport agent before their reports go live.
- Unverified reports stay "unconfirmed" and every report expires.
- Only admins post police updates, copied from TCU advisories.
- Report photos go in a private bucket and phone numbers are never shown.
- Push alerts to drivers whose route crosses a zone. Tests for the risk and advice rules.
- Backtest on Digdol (Apr 2026) and Navyug (Jan 2026). README with setup and API list.
- Left out on purpose: rerouting heavy trucks (no bypass in the gorge), and re-ordering trucks on a single lane. Do not build either.
- Cut list if late: 1. rail/CA slot ranking, 2. nearby help, 3. extra languages, 4. H3 cells (keep zone scores).

### 1.3 What is in the repo (origin/main, commit 964978b)

- The Python risk job: `jobs/run_risk.py` (rules-v0.1, 4 hazards × 6 zones × 4 horizons = 24 rows per run), `jobs/check_run.py`, and 66 pytest tests. GitHub Actions runs it hourly at minute 7.
- Supabase migrations for 8 tables, enums, PostGIS, the `latest_risk` view and RLS (public read on zones, hexes, risk_scores, incidents; the rest marked TODO).
- A small Next.js 16 app (`app/page.tsx`, `app/status/page.tsx`, `lib/supabase/*`), plus `data/incidents.csv`, `seed.js`, `docs/ux/*` and the Round 2 UI/UX files.
- Leftovers from Vercel, which we no longer use: `vercel.json`, the `nh44-routeguard.vercel.app` links and the Hosting row in `README.md`, the Vercel lines in `.env.example`, and the `bom1` and `vercel.json` entries in `docs/decisions.md`. Step 0 removes them (section 4.1).
- Commits: Aryaveer 31, Madhusudan 4, Navaya 0, Riya 0 (35 total). **The judges will see this.** Section 21 fixes it with real work, not padding.

### 1.4 The live demo app (https://routeguard-web-35g6upilva-el.a.run.app), checked 24 Nov 2026

Its source code is **not** in the GitHub repo. That alone fails "repo matches the project" and hides who built what. Step 0 fixes it.

What works:
- Screens: Map, 48 h, Advisor, Board, Report, with bottom navigation. Sign-in uses Clerk (development instance).
- An EN / हिं / اردو switch sets `lang` and `dir` on `<html>`.
- A web manifest and a hand-written service worker (`/sw.js`). It caches the shell, fetches `/api/risk` network-first, caches tiles and has a push handler.
- `GET /api/risk` returns live rules-v0.1 rows from the hourly job. `GET /api/health` returns `{ok, at}`.
- `POST /api/reports` and `POST /api/shipments` return 401 JSON when signed out.
- The advisor checks tonnes (0.1–40) and days since picking (0–120) in the browser, and gives SEND/HOLD/RAIL/DIVERT with a priority line.
- Headers already set: HSTS, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`.

What's wrong (fix all P0 items). These are numbered L1–L15 ("live app") so they don't clash with work-package numbers:

| # | Problem | Priority |
|---|---|---|
| L1 | On a 375 px phone the map page is 560 px wide, so the language switch and Sign in button sit off-screen (the Urdu button is at x≈405). `main.screen` measures 560 px; the zone cards and map canvas about 528 px. Find the element forcing that width with a failing Playwright test first, then fix it (usually a missing `min-width: 0` or a fixed width). Check the other screens at 360 px too. | P0 |
| L2 | When every zone is 0.00, the top card says "Worst on NH-44 now: zone 1". A tie should not crown zone 1. Say "All zones low right now" when nothing is above low, and break real ties by exposure, then zone order. | P0 |
| L3 | The home header shows the title twice ("NH-44 RouteGuard" / "NH-44 ROUTEGUARD"). A visible heading reads "ZONES (SAME AS THE MAP, AS BUTTONS)", which is a developer note; keep that text for screen readers only. | P0 |
| L4 | Hindi and Urdu are mostly untranslated. On the map screen in Urdu, the sync banner is translated but the risk card, legend, hazard chips and zone list stay English (other screens not checked; assume the same). The Clerk sign-in page is English only. The risk "reason" comes from the database in English. In RTL, "+48 h" shows as "h 48+" and the timestamp gets scrambled. | P0 |
| L5 | Sign-in offers email (with password) and Google. The Report page says "Reports are tied to your phone number" and the PPT promises phone OTP. The Clerk app name is misspelt "RouteGaurd", and the page shows Clerk's "Development mode" label. | P0 |
| L6 | Unknown `/api/*` paths return the HTML 404 page. 405 responses have an empty `text/html` body and no `Allow` header. | P0 |
| L7 | `/api/risk` ignores bad query input: `?zone=abc` returns 200 with everything. | P0 |
| L8 | `/api/risk` is sent `Cache-Control: no-store`, though it changes once an hour. That is a free caching win (section 17). | P0 |
| L9 | No OpenAPI/Swagger page at the usual paths (`/api/docs`, `/api/openapi.json` are 404) and no Postman collection. | P0 |
| L10 | `/api/health` returns only `{ok, at}`, with no database or data-freshness check. | P0 |
| L11 | No `Content-Security-Policy` header. | P0 |
| L12 | Advice is computed only in the browser; the network tab shows no advice call, and a judge checking "frontend talks to the real backend" will notice. Move the logic to one shared `decide.ts`. When online the advisor calls `POST /api/v1/advice`; when offline it runs the same `decide()` locally (the PPT says it runs on the phone, which is what makes offline work). A test proves both give the same answer. | P0 |
| L13 | "Priority 2.00 = spoilage 33% × value ₹6 lakh" is a bare number with no unit, and the 33% and ₹6 lakh have no source. Show a band (High/Medium/Low) with the inputs, and label the values as our starting assumptions, kept in a versioned config with notes. | P0 |
| L14 | The advisor labels light trucks "Mughal Road allowed in season", and RAIL assumes the parcel train runs. Check how the code decides. Both should depend on an admin-set road/rail status with a source and a date, and say "unknown, check with TCU / Northern Railway" when unset. | P0 |
| L15 | The service worker is hand-written, while the PPT said Serwist. Keeping it is fine (log the decision). It must never cache authenticated or verification responses, and it must clear private data on sign-out. | P0 |

### 1.5 `data/incidents.csv` was checked against its sources: the numbers don't hold up

| Row | CSV says | What the source says |
|---|---|---|
| 2018-02-06 Ramsu | 24 h, 300 trucks | PTI: reopened after 9 hours, over 400 vehicles stranded ([Business Standard/PTI](https://www.business-standard.com/article/pti-stories/landslide-jammu-srinagar-highway-reopens-after-9-hrs-118020601542_1.html)) |
| 2019-05-09 Digdol | 48 h, 500 trucks | No duration given; "hundreds of vehicles" (IANS report of that day) |
| 2020-03-04 Peera | 24 h, 200 trucks | Article dated 4 Mar. Closure was "on Tuesday" (3 Mar). "Hundreds of vehicles". No duration ([Business Standard/PTI](https://www.business-standard.com/article/pti-stories/landslides-shut-j-k-highway-120030400009_1.html)) |
| 2021-01-24 Banihal | 48 h, 500 trucks | Closed early Saturday 23 Jan, still shut Sunday. No vehicle count ([Tribune](https://www.tribuneindia.com/news/j-k/two-found-dead-in-stranded-vehicle-on-jammu-srinagar-national-highway-203056)) |
| 2024-03-02 Dalwas | 48 h, 1500 trucks | About 2 days is right (closed 2 Mar, one-way traffic 4 Mar). No vehicle count |
| 2024-04-16 Kishtwari Pather | 15 h, 600 trucks | Blocked Monday 15 Apr (article dated 16 Apr). No duration or count |

Also: a stray space before one longitude; "Ramsu" sits on the zone 4/5 boundary; several dates are the article date, not the event date; "vehicles" (includes cars) was written as "trucks". **The 2025 closure and the two backtest events we promised (Navyug Jan 2026, Digdol Apr 2026) are not in the file at all.** Section 14 fixes this.

---

## 2. Rules you never break

**Secrets**
- Never read, print, log or commit `.env`, `.env.local`, `jobs/.env` or any key. Only `.env.example` (names + dummy values) is committed.
- `CLERK_SECRET_KEY` and the Supabase secret/service key are used only in server code. Every module that touches them starts with `import "server-only"`. Only `NEXT_PUBLIC_*` publishable keys reach the browser.
- CI greps the built client bundle (`.next/static`) for `sk_live`, `sk_test`, `sb_secret_`, `service_role` and fails if found. gitleaks runs on every PR.

**Data honesty**
- Every number a user or judge sees either comes from a source we can link or is labelled as our own starting value. No invented figures, in the UI, the README or the CSV.
- Seed/demo rows carry `is_demo = true` and show a small "demo" tag. The only time the UI shows fixtures from `docs/ux/*.json` is a "Replay" screen that says so.

**Scope**
- Don't build rerouting for heavy trucks, re-ordering trucks on a single lane, "report a driver/person", scraping of police or government sites, or any LLM chat feature. None of these is in the PPT, and the first four create real-world harm.
- Don't add features outside section 3's change budget. If you think something is needed, write it in `docs/decisions.md` as a proposal and ask.

**Honest contributions**
- Commit only as the member at the keyboard. No fake authors, no backdating, no empty or trivial commits to pad the count, no splitting one change into ten. 50+ commits must come from real work, and that's easy with four people.

**Safety**
- RouteGuard is advisory. It never tells anyone a road is open, never overrides police instructions, and always shows how old its data is.

---

## 3. Change budget (stay inside the 10–15% rule)

The 7 MVP features, the roles, the risk model and the data design stay as in the PPT. These are the only changes. Log each one in `docs/decisions.md` (dated, with the reason) and in a README table "Changes since Round 1":

| PPT said | Now | Why | Size |
|---|---|---|---|
| Hosting on Vercel (Mumbai) | Azure Container Apps on Aryaveer's Azure for Students subscription. Vercel is dropped completely, including PR previews | We need a real cloud host. Google Cloud's billing setup failed for us; Azure for Students needs no card, so it can never bill us, and its credit covers the round. Container Apps scales replicas up and down, which we show for the scaling bonus | How, not what |
| Supabase Auth, phone OTP | Clerk with a one-time code sent by **email** (no password), Supabase reads Clerk tokens through third-party auth | Same feature, different channel. Clerk's role metadata and test users made it faster. SMS is a paid Clerk feature on our free plan, so the code goes by email (decided 24 Nov 2026) | How, not what |
| Serwist for offline | Hand-written service worker with the same caching policy | Already works; fewer moving parts | How, not what |
| Advice runs on the phone (`decide.ts`) | Same file, also served as `POST /api/v1/advice` | Testable, documented API; phone still works offline | Addition |
| Drivers verified through their agent | Same, plus optional Aadhaar Secure QR check behind a feature flag (P1) | Stronger proof for the verified badge | Addition, optional |
| Extra languages on the cut list | English, Hindi, Urdu built | Users in J&K read Urdu and Hindi; was already planned as a stretch | Planned stretch |
| `users.phone` column in the ER diagram | Phone number stays in Clerk only; our table keeps a verification level | Less personal data in our database | How, not what |
| (not stated) | Cache + queue + autoscaling | Scaling bonus | How, not what |
| Unverified reports stay "unconfirmed" | Drivers post only once verified (agent vouch, or the optional Aadhaar check); agents' reports still start "unconfirmed" (added 26 Nov 2026) | Stops fake reports from reaching the map; matches the PPT's "verified driver reports" | Tightening, not new |

If anyone proposes anything that would change what the product does (a new user type, new core feature, different problem), the answer is no until after the round.

---

## 4. Step 0: get the demo app's code into the repo (tonight, P0)

Owner: Aryaveer with whoever built the demo app. Nobody else edits app code until this is merged.

1. Ask the member: who built the demo app currently on Cloud Run, where is its code, and how is it deployed? Write the answers into `docs/decisions.md`. If the member doesn't want to say, don't guess and don't write a name; continue with the steps that don't need the demo code (6, 8, CI) and leave the import open.
2. Pick the path:
   - **A. It's in another git repo.** Add it as a remote, fetch, and on a branch `import/demo-app` run `git merge --allow-unrelated-histories`. That keeps its commits and authors. The demo app becomes the root Next.js app. Keep this repo's `jobs/`, `supabase/`, `data/`, `docs/`, `scripts/`, `ui ux round/`, `.github/`, `seed.js`, `AGENTS.md`. Port `app/status` into the demo app. Resolve `package.json` by keeping the demo app's dependencies and adding back this repo's scripts (`db:push`, `db:types`). The PR is opened by the demo app's author from their own account.
   - **B. It's only on someone's laptop, with no git history.** The author commits it from their own account in a few honest commits by area (for example "import demo app: map and 48 h screens", "import demo app: advisor", "import demo app: service worker and manifest"). No backdating.
   - **C. Nobody has the code**, or it was built by someone outside the team. Stop and tell the member. Don't copy the deployed JavaScript bundles. We rebuild in the repo, using section 1.4, `docs/ux/` and the Round 2 prototype as the spec. If an outsider built it, the team must check the hackathon rules before using any of it.
3. Find out which Clerk application the demo uses (look at the installed `@clerk/*` packages and the code; never read env files). The Dashboard-selected app is `app_3MY5xJ8fczFe0sOEafACBTW6tNY`. If the demo already uses Clerk, do **not** run `clerk init`. Follow "Existing Clerk projects" in `clerk-setup.md` and ask the member which app to keep. Never switch apps on your own.
4. Check for schema drift. The demo may have changed the database by hand in the Supabase dashboard. Have Aryaveer run `supabase db pull` (or `db diff --linked`; both need Docker running) against the linked project and commit any drift as a new migration. Then `npm run db:types`.
5. `npm ci && npm run build && npm run lint` must pass. Add `npm run typecheck`. Fix what breaks, in separate commits.
6. Add `CLAUDE.md` at the root (Appendix C). It loads `AGENTS.md` and repeats the rules in section 2, so every member's Claude session gets them.
7. Deployment from `main`: write a GitHub Actions workflow that deploys `main` to Azure Container Apps (section 4.1). It signs in to Azure with OpenID Connect, so no password or key is stored in GitHub. Aryaveer does the Azure portal steps by hand; you write the workflow and the steps in `docs/runbook.md`. Don't create Azure resources until the app is ready to deploy (section 4.1).
8. Retire Vercel (section 4.1).

Done when: the app runs from a fresh clone with the README steps, the live URL is built from `main`, `docs/decisions.md` says where the code came from, and nothing in the repo still points at Vercel.

### 4.1 Hosting: Azure Container Apps on Azure for Students, no Vercel

We host on Azure Container Apps, on Aryaveer's **Azure for Students** subscription (US$100 credit, valid to 24 Nov 2027, no card on the account). With no card, Azure can't bill us: when the credit runs out, the resources stop. The credit is all we have, so we spend it carefully, and we show judges the cost page as proof that the setup is cheap.

**Retire Vercel (P0, part of Step 0):**
- In code: delete `vercel.json`. Remove the `nh44-routeguard.vercel.app` links in `README.md` (they come back as the Azure URL once we deploy). Change the Hosting row in the README stack table, and the "Vercel" lines in `.env.example` and the README env table, to Azure Container Apps. Leave the old `docs/decisions.md` entries as they are (it's a log).
- In dashboards (Aryaveer, by hand; you write the steps in `docs/runbook.md`): in the Vercel project settings, disconnect the Git repository so PRs stop getting Vercel checks and preview links, then delete the project.
- PR previews go away. Reviewers test a PR by running it locally (`npm run dev`) and CI runs on every PR.

**Spend the credit carefully (P0; Aryaveer does the portal steps, you write them in `docs/runbook.md`):**
- **Nothing runs on Azure until the app is ready.** We build and test locally and in GitHub Actions. Aryaveer creates the Azure resources on the day we first deploy (aim: 25 Nov evening), not before.
- **One resource group** (`rg-routeguard`) holds everything, so the cost page shows exactly what we spent and one delete removes it all after the round.
- **Region:** Central India if the student subscription allows it (close to Supabase in Mumbai). Azure for Students only allows some regions; if Central India isn't one, use the nearest allowed one and write it in `docs/decisions.md`.
- **Container Apps, consumption plan:** 0.5 vCPU, 1 GiB, `min-replicas 0`, `max-replicas 3`, an HTTP scale rule at 80 concurrent requests. With min 0, nothing is charged while nobody uses the app. Never set min replicas to 1 "to be safe"; on demo day we warm the app up by opening it and calling `/api/v1/health/ready` a few minutes before we present.
- **No Azure Container Registry** (it charges every day it exists). The deploy workflow builds the image in GitHub Actions and pushes it to GitHub Container Registry (`ghcr.io`). The repo is private, so the image is private too; Container Apps pulls it with a read-only GitHub token (`read:packages`) stored as a Container Apps secret. Keep only the last 2 images.
- **Logs:** the Container Apps environment sends stdout to a Log Analytics workspace. Set a daily cap on the workspace (for example 0.1 GB/day). Our "never log bodies" rule (section 15) keeps us far below it.
- **Secrets:** runtime secrets (Clerk secret key, Supabase keys, `JOBS_SECRET`) are Container Apps secrets, referenced as env vars. No Key Vault this week. Never in the image, the workflow file or the repo.
- **Deploy identity:** a user-assigned managed identity with a federated credential for this GitHub repo's `main` branch, given the Contributor role on `rg-routeguard` only. That avoids creating an app registration, which a university Azure account often isn't allowed to do.
- **Cost checks:** set a budget on the subscription (for example US$10) with email alerts at 50%, 90% and 100%. Before the round, screenshot Cost Management → Cost analysis for `rg-routeguard` and put it in `docs/scaling.md` with the date. That's the "we used the credit wisely" evidence.
- **No paid extras:** no Azure Cache for Redis (use the Upstash free tier or the Postgres fallback), no Azure SQL or Postgres (Supabase stays the database), no Front Door, App Gateway or CDN (the `*.azurecontainerapps.io` URL is enough), no VMs.
- **After the round:** stop the container app or delete `rg-routeguard`, so the rest of the credit stays for later.
- Don't write free-grant or price numbers into our docs from memory. If the README or `docs/scaling.md` quotes one, link the Azure pricing page and write the date you checked it.

---

## 5. Target architecture

```
app/                         pages (map, strip, advisor, board, report, admin, privacy, docs)
app/api/v1/**/route.ts       thin route handlers: parse request → call a controller → return
proxy.ts                     Clerk auth, protected route matching (Next.js 16 name for middleware)
src/server/http/             withApi() wrapper: request id, logging, timing, auth + role guard,
                             rate limit, body size limit, Origin check, error → problem+json
src/server/controllers/      read input with zod, call a service, shape the response
src/server/services/         business rules (no HTTP, no SQL): reports, shipments, advice, roles
src/server/repositories/     the only place that talks to Supabase
src/server/schemas/          zod schemas, shared with OpenAPI generation
src/shared/                  code that runs in both browser and server: decide.ts, priority.ts,
                             risk types, reason-code formatter
messages/{en,hi,ur}.json     translations
jobs/                        Python hourly risk job (unchanged structure)
supabase/migrations/         every schema change, in order
```

How a request flows (put this in the README as a sequence diagram):
phone → service worker → `proxy.ts` (Clerk session) → `app/api/v1/reports/route.ts` → `withApi` (request id, rate limit, auth, role) → `reports.controller` (zod) → `reports.service` (dedupe, expiry, trust rules) → `reports.repository` (Supabase client carrying the user's Clerk token, so RLS also applies) → Postgres → queue job → `201 Created` with `Location`.

Two locks on every write: the service checks the role, and the database RLS checks it again. Use the service-role key only in the queue worker and in admin functions that need it. Those functions live under `src/server/admin/` and are never imported by client code.

---

## 6. API contract (P0)

All JSON APIs live under `/api/v1`. Old paths (`/api/risk`, `/api/reports`, `/api/shipments`, `/api/health`) answer with a `308` to the v1 path until the client is switched over, then remove them before the round.

**Responses**
- Single item: `{ "data": {...} }`. List: `{ "data": [...], "meta": { "count", "next_cursor", "run_at"? } }`. Use cursor pagination, `limit` capped at 100.
- Errors are always `application/problem+json`: `{ type, title, status, detail, instance, request_id, errors?: [{ path, message }] }`. Never send stack traces, SQL or library messages to the client.
- Every response carries `X-Request-Id`. Successful creates return `201` with a `Location` header.

**Status codes we use**
- 200 · 201 · 204 · 304 (ETag match).
- 400: malformed JSON or query.
- 401: signed out. 403: wrong role, or not your row.
- 404: unknown id or path, JSON even for unknown `/api/*` paths. 405: with an `Allow` header.
- 409: duplicate, for example an active shipment for the same truck.
- 413: body or photo too big. 415: wrong `Content-Type`.
- 422: valid JSON that breaks the rules (zod).
- 429: with `Retry-After`. 500: generic message + request id.
- 503: database unreachable.

**Validation (zod, `.strict()` everywhere; unknown fields give 422)**
- Strings: trimmed, NFC-normalised, control characters rejected, max lengths set.
- Enums: strict. Numbers: ranges as in the app (tonnes 0.1–40, days since picking 0–120).
- Truck numbers: uppercase, spaces removed, must match the normal state format (`JK05G7712`) or Bharat series (`22BH1234AA`).
- `lat`/`lng`: inside the NH-44 corridor box (about lat 32.6–34.2, lng 74.7–75.4); else 422 "outside the NH-44 corridor".
- Dates: harvest not in the future.
- JSON bodies: max 32 KB. Photos: max 5 MB, JPEG/PNG/WebP checked by magic bytes, not by extension. No SVG, ever.

**Endpoints**

| Method & path | Who | Notes |
|---|---|---|
| `GET /api/v1/health` | public | Liveness, no DB |
| `GET /api/v1/health/ready` | public | DB reachable + `data_age_minutes` + `stale` (over 90 min); 503 if DB down |
| `GET /api/v1/zones` | public | Names keyed by id; translations come from messages |
| `GET /api/v1/risk?horizon=0\|12\|24\|48&zone=1..6` | public | Latest run; ETag = run_at; cached (section 17) |
| `GET /api/v1/risk/summary?lang=en\|hi\|ur` | public | `text/plain`, under 5 KB, for low signal (PPT feature 7) |
| `GET /api/v1/risk/hexes?horizon=` | public | P1, only if H3 data is loaded |
| `POST /api/v1/advice` | public, rate-limited | Runs `src/shared/decide.ts`; nothing stored |
| `GET /api/v1/reports?zone=&status=` | public | Active, non-hidden reports. No user ids or phone numbers |
| `POST /api/v1/reports` | driver, agent, police, admin | multipart (photo optional); `Idempotency-Key` header required |
| `POST /api/v1/reports/{id}/confirm` | verified driver, agent, police, admin | One per user; can't confirm your own |
| `POST /api/v1/reports/{id}/flag` | signed in | Reason enum |
| `GET /api/v1/official-updates` | public | Active police/TCU updates with source link |
| `GET /api/v1/incidents` | public | Verified history only |
| `GET /api/v1/me` / `PATCH /api/v1/me` | signed in | Name, language, consents |
| `POST /api/v1/me/onboarding` | signed in | Pick a self-service role: grower, trader, agent, driver |
| `DELETE /api/v1/me` | signed in | Deletes the account, anonymises reports |
| `GET /api/v1/shipments` | grower/trader (own), agent (own fleet), driver (assigned) | |
| `POST /api/v1/shipments` | grower, trader, agent | Stores the advice snapshot; 409 on duplicate active truck |
| `PATCH /api/v1/shipments/{id}` | owner agent | Status, driver, ETA |
| `POST /api/v1/shipments/{id}/location` | assigned driver, consent on | Stored coarse (~1 km) |
| `POST /api/v1/agents/drivers/{driverId}/vouch` | agent | Driver must have accepted that agent's invite |
| `POST /api/v1/push/subscriptions` / `DELETE` | signed in | P1 |
| `POST /api/v1/verify/aadhaar-qr` | driver, agent | P1, behind `FEATURE_AADHAAR_QR` (section 11) |
| `GET /api/v1/model` | public | Model card + backtest numbers (P1) |
| `PATCH /api/v1/admin/users/{id}/role` | admin | `reason` required, audited |
| `POST/PATCH/DELETE /api/v1/admin/official-updates[/{id}]` | admin, police | Source URL required; delete is soft with a reason; audited |
| `PATCH /api/v1/admin/reports/{id}` | admin | hide/resolve with reason; audited |
| `PATCH /api/v1/admin/road-status` | admin | Mughal Road open?, rail parcel running?, source, date |
| `GET /api/v1/admin/audit-log` | admin | Read-only |
| `POST /api/v1/internal/jobs/run` | `JOBS_SECRET` header (constant-time compare) | Queue worker (section 17) |
| `GET /api/v1/openapi.json`, page `/api/docs` | public | Swagger UI served from our own files, not a CDN |

**OpenAPI:** generate it from the same zod schemas (zod 4's built-in JSON Schema output, or `@asteasolutions/zod-to-openapi`; check which fits the installed zod). Every endpoint gets examples for success and for each error status. CI fails if a route under `app/api/v1` is missing from the spec.

**Postman:** `postman/RouteGuard.postman_collection.json` + `postman/local.postman_environment.json` (no secrets; tokens come from a pre-request script using Clerk test users). Each request has tests for status code and shape, including the error cases. CI runs it with newman against `next start`.

---

## 7. Database (P0 unless marked)

All changes are new, additive migrations in `supabase/migrations/`. Never edit an applied migration. Aryaveer applies them (`npm run db:push`) after review, then `npm run db:types`.

**Users move to Clerk ids.** `users.id` becomes `text` (Clerk `user_...`), with no FK to `auth.users`. Every FK to it changes too (`reports.user_id`, `shipments.agent_id`, `shipments.driver_id`, `users.agent_id`). First count the rows in those tables; if any real rows exist, stop and ask.

`users`:
- `id text pk`, `role user_role`, `display_name`, `language` (`en|hi|ur`).
- `agent_id text` (for drivers), `verification_level` (`none|email|agent_vouched|aadhaar_qr|official`), `location_consent bool`.
- `created_at`, `deleted_at`. Phone numbers stay in Clerk only; don't copy them into our database.

New tables:
- `verifications`: `id`, `user_id`, `method` (`agent_vouch|aadhaar_qr|admin`), `verdict` (`verified|manual_review|rejected`), `last4` (Aadhaar only), `verified_by`, `consent_version`, `cert_version`, `created_at`. **Nothing else.**
- `report_confirmations` (`report_id`, `user_id`, pk on both, `created_at`) and `report_flags` (`report_id`, `user_id`, `reason`, `created_at`).
- `official_updates`:
  - `id`, `zone_id`, `kind` (`closure|one_way|reopened|advisory`), `title`, `body`;
  - `source_url not null`, `source_name`, `issued_at`, `valid_until not null`;
  - `version`, `supersedes_id`, `created_by`, `deleted_at`, `delete_reason`.
- `road_status`: one row per item (`mughal_road`, `rail_parcel`): `state` (`open|closed|unknown`), `source_url`, `updated_by`, `updated_at`.
- `push_subscriptions` (P1): `id`, `user_id`, `endpoint unique`, `keys jsonb`, `zones int[]`, `created_at`.
- `audit_log`: `id bigserial`, `at`, `actor_id`, `actor_role`, `action`, `target_type`, `target_id`, `reason`, `request_id`, `meta jsonb` (no personal data). Insert only, through a `security definer` function. Nobody can update or delete; admins can read.
- `idempotency_keys`: `key`, `user_id`, `route`, `response_status`, `response_body`, `created_at`. Expire after 24 h.

Changed tables:
- `reports` gains:
  - `client_id uuid unique` (idempotency), `source` (`driver|police|admin`);
  - `status` (`unconfirmed|confirmed|resolved|expired|hidden`), `confirmations int`, `expires_at not null`;
  - `hidden_reason`, `photo_path`, `is_demo`.
- `shipments` gains `is_demo` and an `advice` jsonb snapshot (`decision`, `reason_code`, `rules_version`, `risk_run_at`).
- `risk_scores` gains `reason_code text` and `reason_params jsonb`. Keep the English `reason` for older clients.
- `incidents` gains the evidence columns from section 14.

**RLS.** Turn it on for every table, and use `(select auth.jwt()->>'sub')` for "my rows" and `auth.jwt()->'metadata'->>'role'` for roles:
- Public read: zones, hexes, risk_scores, incidents (verified only), official_updates (not deleted), and reports (not hidden, through a view that leaves out `user_id`).
- `users`: read your own row; agents read their drivers; admins read all. Self-update is limited to `display_name`, `language` and consents. A trigger blocks changes to `role` and `verification_level`.
- `reports`: insert only with `user_id = sub` and an allowed role; no updates from users; admins update through the admin service.
- `shipments`: owner agent, the creating grower/trader, and the assigned driver.
- `verifications` and `audit_log`: admins read; inserts only through `security definer` functions.
- Write RLS tests (pgTAP via `supabase test db`, or a Vitest suite that signs in as each test user) proving that a driver can't read another agent's shipments and a grower can't post an official update.

**Constraints over hope.** Write `check` constraints matching the zod rules (tonnes range, `expires_at > created_at`, `valid_until > issued_at`). Add indexes for every filter we use (zone + status + expires_at on reports, agent_id on shipments).

---

## 8. Login, roles and Clerk (P0)

Follow `docs/round3/clerk-setup.md` for anything about installing or linking Clerk. Its rules win.

**Dashboard steps (a human does these; you write them in `docs/runbook.md`):**
- Fix the application name to "RouteGuard".
- Turn on email sign-in with an email verification code (no password). Phone SMS is a paid feature on our Clerk plan (checked 24 Nov 2026), so it stays off. The app copy says "email" everywhere. Never claim "phone" where it isn't true.
- Sessions → customise session token → add `"metadata": "{{user.public_metadata}}"`.
- Turn on Clerk's Supabase integration (adds the `role: authenticated` claim). In Supabase → Authentication → Third-party auth, add Clerk.
- Test users: `name+clerk_test@example.com` emails (code `424242`). Create one per role (section 19). Ask before creating users in an existing app.

**In code:**
- `proxy.ts` uses `clerkMiddleware` with `createRouteMatcher`. Protect `/board`, `/report/new`, `/admin/**`, and every non-public `/api/v1/**`.
- Pages read `await auth()`. Any server component that reads auth sits inside `<Suspense>` when `cacheComponents` is on.
- The server Supabase client passes the Clerk token: `createClient(url, publishableKey, { accessToken: async () => (await auth()).getToken() })`.
- Roles live in Clerk `publicMetadata.role` (users can't change it from the browser). Our `users.role` mirrors it, written only by the server.
- `POST /api/v1/me/onboarding` lets a user pick grower, trader, agent or driver once. Changing it later needs an admin.
- **police and admin are never self-service.** Only an admin can grant them, through `PATCH /api/v1/admin/users/{id}/role` with a written reason, and it is audited. For the hackathon, the police account is a clearly labelled demo account.
- After a role change, the user's token can be stale for up to about a minute. The UI says "refresh to see your new role".
- Sign-in screens must work in all three languages. Clerk ships Hindi (`hiIN`) but not Urdu. Build a small custom email-code sign-in with Clerk's hooks so every string comes from our messages files; keep Clerk's prebuilt `<UserButton>`. If the custom flow isn't done in time, use `hiIN` for Hindi, a partial Urdu localisation object for the main strings, and log the gap.

---

## 9. Verification: what "verified" means everywhere (P0)

Write this as `docs/verification.md` and show a one-line version in the app wherever a badge appears.

**People**

| Level | How you get it | What it unlocks |
|---|---|---|
| `email` | Clerk email code | Sign in, save lots, flag reports |
| `agent_vouched` | Your transport agent vouches for you after you accept their invite (PPT) | Driver reports go live as "verified driver" |
| `aadhaar_qr` | P1: Secure QR signature checks out on our server and the name matches your profile | Same badge, stronger. It is never required |
| `official` | Admin grants police or admin with a written reason | Post official updates |

**Reports**
- New report from a verified driver, police or admin → shown at once with a solid marker.
- From anyone else → "unconfirmed", dashed marker. *(26 Nov 2026: drivers can't post until verified, so in practice this is an agent's report; see `docs/decisions.md`.)*
- Confirmed when two other verified users within 2 km confirm it within 3 h, or police/admin confirms it.
- Expiry by type, kept in config: landslide/rockfall 6 h, accident 3 h, snow/ice 12 h, flash flood 6 h. Expired reports leave the map but stay in history.
- Duplicates: the same hazard within 500 m and 60 min becomes a confirmation of the first report, not a new pin.
- Three flags from different users hide an unconfirmed report until an admin looks at it.
- The risk job raises confidence only from **confirmed** reports and official updates (PPT rule: "high if a confirmed report or police update in the last 6 h agrees").

**Official updates**
- Each one has a source link, an issue time and an expiry. It is shown with "From J&K Traffic Police advisory · source · time". Edits make a new version; deletes are soft with a reason; everything is audited.

**Data**
- `incidents.csv` follows section 14. Thresholds and assumptions live in versioned config files with a note on where each value came from.

**Translations**
- Safety text (SEND/HOLD/RAIL/DIVERT, warnings, disclaimers, consent screens) is checked by a fluent Hindi reader and a fluent Urdu reader. They are logged in `messages/REVIEW.md` with name and date. Machine-drafted strings that haven't been reviewed are listed there as "not yet reviewed".

**Builds**
- After every deploy, a smoke test hits `/api/v1/health/ready`, `/api/v1/risk` and the home page, and fails the workflow if any is wrong.

---

## 10. Police and safety guardrails (P0)

We have no partnership with the police. The app must never look like it speaks for them.

1. **Not official.** The footer on every screen and the sign-in page says, in all three languages: "RouteGuard is a student project. It is not an official government or police service. Follow instructions from J&K Traffic Police. In an emergency call 112." Use no police logos, emblems, uniforms or government seals anywhere.
2. **Official updates are copies with sources.** An admin or a demo police account types in what a public TCU/J&K Traffic Police advisory said, with the link. We don't scrape their sites. We never write our own instructions as if they were official.
3. **Who can do what.** police/admin roles are granted only by an admin with a written reason. Every privileged action goes into `audit_log` (who, what, when, why, request id). The audit log can't be edited or deleted by anyone, including admins.
4. **Reports are about the road, not people.**
   - Hazard types only (landslide, rockfall, flash flood, snow/ice, accident, other). No free-text field asks for names or vehicle numbers. Notes are capped at 280 characters, and phone numbers or vehicle numbers in notes are masked before saving.
   - The photo screen says "Photograph the road, not people or number plates".
   - EXIF is stripped from every photo on the server before storage (`sharp`). Location comes from the app's GPS reading, never from EXIF.
   - Photos sit in a private bucket and are shown through signed URLs that expire in 10 minutes.
5. **Location privacy.**
   - Drivers turn location sharing on themselves. It is shared only with their own agent and stored at about 1 km precision.
   - We keep only the latest point. It is cleared 7 days after delivery.
   - `DELETE /api/v1/me` removes the account and anonymises reports.
6. **Abuse limits.**
   - Rate limits: 10 reports/hour, 30 confirmations/hour, 5 role or verification attempts/hour per user, 60 advice requests/minute per IP. On Azure Container Apps, take the client IP from the first `X-Forwarded-For` entry (set by the Container Apps ingress) and nowhere else.
   - Admins can turn report posting off with `FEATURE_REPORTS_WRITE=false` if it gets spammed. The app then shows "reporting paused".
7. **No automatic road decisions.** Reports and scores never mark the road "open". Copy says "may close" or "reported blocked", never "safe".
8. **Privacy notice.** `/privacy` in three languages (following India's DPDP Act 2023): what we collect, why, how long, how to delete, and a contact email. Show a consent step before location sharing and before the Aadhaar check. Store `consent_version` with every consent.
9. **Helplines.** Link 112. Before showing any TCU helpline number, verify it on an official J&K Traffic Police source and write the source and date in `docs/sources.md`. If it can't be verified, link the official page instead of printing a number.

Write all of this into `docs/guardrails.md` with a short "why" for each rule. Judges will ask.

---

## 11. Aadhaar Secure QR (P1, behind `FEATURE_AADHAAR_QR`)

Do this only after every P0 item is merged. It is optional for users and never needed to use the app. Follow the team's "Aadhaar Verification in a PWA" guide. The key points:

- **Consent first,** in three languages: what we check, what we keep (only the result and the last 4 digits), and that they can use agent vouching instead. Store `consent_version`.
- **Scan in the browser, verify on the server only.** The page reads the QR text with a camera QR library and POSTs `{ qr, consent: true }` over HTTPS to `/api/v1/verify/aadhaar-qr`. Never verify in browser JavaScript. Never ask anyone to type their Aadhaar number, and never upload card photos.
- **Server steps:**
  1. Cap the input size.
  2. The QR text is a big decimal number. Convert it to bytes (BigInt).
  3. Decompress with Node `zlib.unzipSync` (it auto-detects gzip or zlib headers, like Python's `zlib.decompress(raw, 47)` in the guide), with `maxOutputLength` set to block zip bombs.
  4. The last 256 bytes are the signature. Verify RSA-SHA256 over the rest with the UIDAI certificate.
  5. Split fields on byte `255`.
  6. Compare the name to the user's profile name in memory.
  7. Verdict: `verified` (signature good, name matches), `manual_review` (signature good, name differs slightly), `rejected` (anything else).
  Take the exact byte layout (V2 has a version prefix and an email/mobile indicator) from UIDAI's current spec. The guide warns that small layout mistakes silently break verification.
- **Certificate pinned and versioned** in `config/uidai/` with its SHA-256 fingerprint checked at startup. Record `cert_version` on each verification.
- **Store only:** `verification_id, user_id, method, verdict, last4, verified_at, consent_version, cert_version`. Never store or log the QR text, name, DOB, address or photo. The logger redacts the whole body for `/api/v1/verify/*`, Sentry drops it, and the service worker sends these routes network-only and never caches them. Nothing goes to localStorage, IndexedDB or the Cache API.
- **Rate limit:** 5 tries per user per hour.
- **Tests** with a key pair generated in the test (never a real person's data): valid, one byte tampered, wrong certificate, truncated, oversized, not a number, zip bomb, and a log check that no payload appears.
- **Demo.** Use a synthetic QR signed with our test key. The test key is accepted only when `AADHAAR_ALLOW_TEST_CERT=true`, and then the badge reads "Demo check (test key)". **No real Aadhaar card is scanned on stage or in screenshots.**
- **Limits to state honestly (README + Q&A).** A genuine QR proves the card is real, not that the person holding it owns it. Production use needs UIDAI OVSE registration and a legal review. We are a prototype.

Skip the Offline XML / e-KYC path (P2).

---

## 12. Languages: English, Hindi, Urdu (P0)

- Use `next-intl` **without locale routing**. The locale comes from a cookie (`rg_lang`), with the signed-in user's `language` as the default. The server renders `<html lang dir>` correctly on the first paint. No `[locale]` folders, which keeps `proxy.ts`, Clerk and the service worker simple. Move the existing `rg:lang` localStorage value into the cookie once.
- `messages/en.json`, `hi.json`, `ur.json`, keyed by screen (`map.*`, `advisor.*`, ...).
  - No string concatenation; use ICU placeholders and plurals.
  - CI fails if any key is missing in any file or has a different set of placeholders.
  - Every screen is covered, including errors from the API: the client maps `problem.type` to a message key.
- **Reasons from the risk job.** `run_risk.py` writes `reason_code` (for example `rockfall_rain_48h`) and `reason_params` (`{ "mm": 18, "place": "navyug" }`). The app renders the translated sentence. Old rows fall back to the English `reason` with a small "English" tag. Add pytest cases for every code.
- **Zone and place names** come from translation keys by id. Spellings are confirmed by the fluent reviewers; don't trust a machine for place names.
- **RTL.**
  - `dir="rtl"` for Urdu, with Tailwind logical classes (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`).
  - Flip arrows that point back or forward. Don't mirror the map.
  - Wrap numbers, times, truck numbers and "+48 h" style tokens in `<bdi>`, or render them through `Intl` with the locale, so they don't scramble.
  - Use Latin digits in all three languages (`-u-nu-latn`) so truck numbers, times and phone numbers read the same everywhere. Change this only if the Urdu reviewer prefers otherwise.
- **Fonts.**
  - Noto Sans Devanagari for Hindi.
  - For Urdu, Noto Nastaliq Urdu (line-height at least 1.9) or Noto Naskh Arabic if Nastaliq is too tall on small phones. The Urdu reviewer picks.
  - Self-host the fonts and load them only for that locale.
- **Listen button.** Use `speechSynthesis` with the matching voice. Hide the button if the phone has no Hindi or Urdu voice instead of reading Urdu in an English voice.
- **Map labels:** P2, MapLibre `["coalesce", ["get","name:hi"], ["get","name"]]` (and `name:ur`).
- **Tests.** A Playwright test switches to Urdu and asserts `dir=rtl`, no element wider than the viewport at 360 px, and no English left on the main screens (a check against the `en` values).

---

## 13. Offline (P0)

Keep the hand-written service worker and write its policy at the top of `public/sw.js` and in `docs/offline.md`:

- **Cache first:** static assets (hashed names), self-hosted fonts.
- **Network first, fall back to last good copy:** the app shell pages, `/api/v1/risk`, `/api/v1/zones`, `/api/v1/official-updates`, `/api/v1/incidents`, `/api/v1/risk/summary`. Show "using scores from 14:07 (2 h old)" whenever data came from the cache.
- **Map tiles:** corridor only, capped (as now).
- **Network only, never cached:** everything authenticated (`/api/v1/me`, `/shipments`, `/admin/*`), `/api/v1/verify/*`, and any response with `Cache-Control: private` or `no-store`.
- **Private data offline:** the signed-in user's own lots and board go in IndexedDB under their user id and are wiped on sign-out (also call `caches.delete` for any private cache).
- **Report outbox:** a report made offline is saved in IndexedDB with a client UUID. The photo is compressed in the browser to about 300 KB first. It is sent when back online, with `Idempotency-Key: <uuid>` so retries never create duplicates. Show "2 reports waiting to send". Try again on app open and on the `online` event; Background Sync is a bonus where supported.
- **Offline advice:** `decide()` runs on cached risk and shows the same answer as the API. A test checks that both give the same result for the same input (a PPT success measure).
- **Updates:** when a new service worker is waiting, show "New version ready. Reload". Don't silently `skipWaiting` mid-form.
- **Test:** Playwright with `context.setOffline(true)`: the map loads, the advisor answers, a report queues and is sent after going online. Also rehearse airplane mode on a real Android phone.

---

## 14. `incidents.csv`: verify, then expand (P0)

Owner: Madhusudan, with a second member verifying every row. Nothing gets loaded into the database until it passes.

**New columns** (a migration adds them to `incidents`; `seed.js` loads them):

```
id, event_start_date, event_end_date, date_basis, zone_id, place, lat, lng, coord_basis,
hazard_type, hours_closed, hours_basis, vehicles_stranded, trucks_stranded, apple_trucks_mentioned,
source_url, source_publisher, source_published_date, evidence_quote, archive_url,
second_source_url, added_by, verified_by, verified_on, confidence, notes, is_demo
```

**Rules**
1. Event date is not the article date. If the article says "on Monday", work out the date and set `date_basis = inferred_weekday`. Use `stated` only if the date is written out, and `article_date` only if nothing else is known.
2. **Numbers only when the source states them.** `hours_closed` only if the source gives a duration or both closing and reopening times. Leave it empty otherwise and put what's known in `notes` ("closed Sat, one-way traffic Mon").
3. "Hundreds of vehicles" stays empty with a note. Never turn words into numbers.
4. Vehicles and trucks are different columns; "vehicles cleared" is not "vehicles stranded".
5. `evidence_quote`: the exact words (up to 25) that support the numbers and date. No quote, no number.
6. **Coordinates** come from looking up the named place on OpenStreetMap (`coord_basis = osm_place`), to 4 decimals. The validator checks that the point is within 2 km of the NH-44 line (use `jobs/points.json` or the corridor geometry). The zone is computed from the coordinates and the zone boundary places, not guessed.
7. **Sources.**
   - Prefer PTI/IANS wire copies, All India Radio (newsonair.gov.in), official J&K Traffic Police posts, then The Tribune, Greater Kashmir, Daily Excelsior.
   - Not allowed: WhatsApp forwards, unsourced blogs, pages marked "AI generated", or Wikipedia as the only source.
   - Try to save each source in the Wayback Machine and fill `archive_url`.
8. **Two people per row.** `verified_by` must differ from `added_by`. The verifier opens the source and checks every filled field against it.
9. Rows that can't be verified move to `data/incidents_unverified.csv`, which is never loaded.

**Validator:** `scripts/validate_incidents.py` (standard library only, plus pytest tests), run in CI. It checks:
- columns, types, enums and date order;
- the corridor distance, and that the zone matches the coordinates;
- that every number has an `evidence_quote`, and that `verified_by ≠ added_by`;
- https URLs, no stray whitespace, and no duplicate (date, zone, hazard).

**Expand.**
- Aim for 25–40 verified rows from 2018–2026, with quality over count.
- Must include the Aug–Sep 2025 closure, Navyug (Jan 2026) and Digdol (Apr 2026), because the backtest depends on them.
- Appendix B lists leads I found. They are leads, not facts; verify each one like any other row.

**In the app.** The incidents list shows source links. Empty numbers show as "not reported" rather than 0. The README says how many rows exist, from which years, and that the list is not complete (so false-alarm counts are rough).

---

## 15. Reliability: errors, logging, health (P0)

- **`withApi()` wraps every handler.** It:
  - makes a request id (or reuses an incoming `X-Request-Id` if it's a valid UUID);
  - times the call;
  - catches every error and maps known errors (`ValidationError`, `AuthError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `RateLimitError`) to problem+json;
  - logs unknown errors with the stack on the server only and returns a generic 500.
- **Logging with `pino`,** JSON to stdout (Container Apps sends it to Log Analytics):
  - Fields: `time, level, request_id, method, route, status, duration_ms, user` (a SHA-256 hash, first 12 characters), `role`.
  - Never log bodies, tokens, cookies, phone numbers, photos, QR text or query strings on `/verify`. Test that the redaction works.
- **Sentry** (P1) for server and client errors, with `sendDefaultPii: false` and request bodies dropped. Add an uptime check on `/api/v1/health/ready`.
- **Stale data banner.** If the latest run is over 90 minutes old, every screen shows "Scores last updated 16:07. The hourly update is late." `/ready` reports `stale: true`.
- **Timeouts.** Supabase calls time out after 5 s, then return 503 with a problem body. External calls never block a page render.
- **Feature flags** read from env at start-up: `FEATURE_AADHAAR_QR`, `FEATURE_PUSH`, `FEATURE_REPORTS_WRITE`, `AADHAAR_ALLOW_TEST_CERT`. List them in `.env.example` with comments.
- **`docs/runbook.md`:** what to do if Clerk, Supabase, the hourly job or the venue Wi-Fi fails on demo day (phone hotspot, offline mode, the local `npm run start` fallback, the screen recording).

---

## 16. Security checklist (P0)

- **Auth on every non-public route.** Tests check that signed-out gets 401 and the wrong role gets 403 for each route in the table.
- **Role checks happen in two places:** the service, and RLS in the database.
- **SQL injection.** Only the Supabase client's typed filters (`.eq()`, `.in()`, `.gte()`) with values that passed zod. **Never put user input inside `.or()`, `.filter()` or `.textSearch()` strings.** PostgREST filter strings can be injected just like SQL. Any database function takes parameters and never builds SQL with `format()` from input. Add a test that a value like `x),id.gt.0` is treated as plain text.
- **XSS.** No `dangerouslySetInnerHTML`. User text is rendered as text. Links from official updates must be https, are shown with their domain, and use `rel="noopener noreferrer nofollow"`. Uploaded files are never served from our origin as HTML or SVG. Add a test that `<script>alert(1)</script>` in a note comes back escaped.
- **CSP.**
  - Follow the CSP guide in `node_modules/next/dist/docs/` (nonce from `proxy.ts`) and Clerk's CSP notes.
  - Allow only what we use: our origin, the Clerk frontend API and its challenge frame, Supabase, OpenFreeMap tiles, `blob:` workers for MapLibre.
  - Ship it as `Content-Security-Policy-Report-Only` first, fix the violations, then enforce.
  - If nonces break something we can't fix in time, enforce a strict policy without nonces and write the trade-off in `docs/decisions.md`.
- **CSRF.** State-changing requests must have JSON or multipart content type and an `Origin` that matches our host; otherwise 403.
- **Limits.** Body size limits, upload checks by magic bytes, and rate limits (section 10) on a shared store so they hold across instances (section 17).
- **Headers.** Keep the existing ones. Add `Cross-Origin-Opener-Policy: same-origin`, and `Cache-Control: no-store` on authenticated APIs.
- **Supply chain.**
  - gitleaks, `npm audit --audit-level=high` and Dependabot alerts.
  - Pinned versions with the lockfile committed; `npm ci` in CI.
- **`.env.example`** lists every variable with a comment saying where it's used and whether it's public.
- **`docs/security.md`** lists each protection, the file it lives in, and the test that proves it. This is the page you open when a judge asks "how do you stop X?".

---

## 17. Scaling (bonus 5): build it, measure it, explain it

Only claim what is actually built and configured. Each member should be able to explain at least one piece.

1. **Read path cache** (Navaya):
   - `GET /api/v1/risk` sets `ETag` = latest `run_at` and answers `If-None-Match` with 304.
   - It sends `Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=3300` (data changes hourly).
   - The server keeps a small in-memory cache per instance (60 s) and a shared Redis cache keyed by `run_at` (Upstash Redis free tier, if a member creates it; that's a human step). Without Redis, document the in-memory and HTTP caching only.
   - Measure p50/p95 before and after with `autocannon`. Put the table in the README with the date and machine.
2. **Queue for writes** (Madhusudan):
   - Use Supabase Queues (`pgmq`). `POST /reports` saves the report, strips EXIF right away, enqueues a `report.created` job and returns 201.
   - The worker (`/api/v1/internal/jobs/run`, protected by `JOBS_SECRET`) does the slow work: thumbnail, dedupe and merge, updating confirmation counts, and push fan-out (P1).
   - A scheduler calls the worker every minute (Supabase `pg_cron` + `pg_net`, which is free and already ours, with the secret in Supabase Vault; GitHub Actions every 5 min as a fallback, though GitHub often delays scheduled runs).
   - Messages that fail 5 times go to a dead-letter table shown on the admin page.
3. **Horizontal scaling** (Aryaveer):
   - The app is stateless: sessions are Clerk tokens, and rate limits and cache live in Redis/Postgres, not in memory that matters.
   - Container Apps settings, committed in the deploy workflow: `min-replicas 0` (we warm the app up by hand before the demo, see section 4.1), `max-replicas 3`, HTTP scale rule at 80 concurrent requests. The Container Apps ingress load-balances across replicas.
   - Run a short load test (a minute or two, to save credit) and screenshot the replica count rising in the portal's Metrics page.
   - Database connections: the server uses Drizzle over the Supabase transaction pooler (port 6543), at most 5 connections per replica (`docs/decisions.md`, ORM).
4. **Compute once, read many** (from the PPT): risk is scored once an hour for everyone, not per request. Say this first; it's the strongest point.
5. **Not built: read replicas.** Mention them only as a next step.

Write `docs/scaling.md` with a diagram (client → Container Apps replicas → Redis → Supabase, plus the queue → worker → push path), the settings, and the measured numbers.

---

## 18. Tests and performance (P0)

- **Vitest unit tests:**
  - `decide.ts`: table-driven, every answer plus the edges, including Mughal Road and rail unknown.
  - `priority.ts`; zod schemas (good and bad inputs); truck number normaliser; problem+json mapper.
  - Rate limiter; reason-code formatter in all three languages; i18n key parity; CSV validator (pytest).
- **API integration tests:**
  - Call the route handlers with repositories swapped for in-memory fakes.
  - Cover every status code in section 6 and every role in the access table.
  - The RLS tests from section 7 run against a local Supabase (`supabase start`) where Docker is available. Document how to run them.
- **Existing pytest suite** keeps passing, plus new tests for `reason_code`.
- **Playwright (mobile).**
  - Pixel 5 profile plus a 360 px viewport: home with no horizontal overflow, language switch and RTL, advisor flow.
  - Sign in as a test user with `@clerk/testing`, create a report, offline queue and sync.
  - The admin posts an official update and the public sees it with its source.
- **Postman/newman** in CI (section 6).
- **Performance.** `scripts/load/risk.js` (autocannon) records p50/p95 for `/api/v1/risk` cold, warm and with 304. Lighthouse mobile scores for Performance, Accessibility, Best Practices and PWA go in the README with the date.
- **CI** (`.github/workflows/ci.yml`) on every PR:
  - lint, typecheck, Vitest, pytest, CSV validator;
  - i18n check, OpenAPI coverage check;
  - build, client-bundle secret grep, gitleaks, npm audit;
  - newman against `next start`, and Playwright smoke.
  Keep the job under about 10 minutes and cache npm.

---

## 19. Seed data and demo accounts (P0)

- **`scripts/seed-demo.ts`** (Aryaveer writes and runs it locally because it needs secret keys). It is idempotent: it creates or updates and never duplicates. It creates:
  - one admin, one demo police account labelled "Demo police account", one agent, two drivers (one vouched, one not), one grower;
  - each with a Clerk test identity;
  - 6 shipments on the agent's board in different states;
  - 4 reports (one police, one confirmed, one unconfirmed, one expired);
  - 2 official updates with real public source links (taken from the verified incidents);
  - `road_status` rows.
  All demo rows have `is_demo = true`.
- **README "Try it" table:** role, test login (`+clerk_test` email), code `424242`, and what to try. No real phone numbers.
- **`scripts/seed-demo.ts --reset`** removes only `is_demo` rows.
- Before the round, Aryaveer takes a data backup (`supabase db dump --data-only` to a local file that is **not** committed).

---

## 20. Docs, README and commits (P0, bonus + roles marks)

**Commits**
- Conventional Commits:
  - `feat(api): add POST /api/v1/reports with idempotency`
  - `fix(i18n): stop RTL scrambling of +48 h labels`
  - `test(advice): cover rail unknown case`
  - `docs(readme): add request trace diagram`
  - also `chore(ci): …`, `refactor(…): …`, `perf(risk): …`.
- One logical change per commit. The body says why, in plain words, and ends with `Refs #<issue>`.
- When two members pair, add `Co-authored-by: Name <github-noreply-email>`.
- Each member checks `git config user.email` matches an email verified on their GitHub account, otherwise their commits won't count on their profile. Add a `.mailmap` so the two "Aryaveer" author names show as one.
- **Merge PRs with "Create a merge commit" or "Rebase and merge". Never squash.** Squashing collapses commits and hides who did what.

**GitHub**
- An issue for every task in section 21, assigned to its owner, on a GitHub Project board (To do / Doing / Review / Done). Labels `P0`, `P1`, `area:*`. This is the "tasks owned" evidence.
- `.github/pull_request_template.md`: What, Why, How I tested, Screenshots (mobile), Judge criterion this helps, Checklist (tests, docs, no secrets).
- `.github/CODEOWNERS` mapping folders to owners.
- Every PR is reviewed by another member before merge, even without branch protection.

**README**
- Rewrite it, keeping the good existing sections, in this order:
  1. What it does, who it's for (3 lines)
  2. Live link, "Try it" accounts
  3. Screenshots (mobile, EN/HI/UR)
  4. How it works: architecture diagram + the traced request
  5. API: link to `/api/docs` and the Postman collection, plus a table of endpoints
  6. Security and guardrails (short, links to docs)
  7. Verification levels
  8. Languages
  9. Offline
  10. Data and sources (incidents provenance)
  11. Risk model and backtest
  12. Testing: how to run, what's covered, numbers
  13. Performance and scaling: measured numbers
  14. Changes since Round 1
  15. Team: who owns what, linking to their PRs
  16. Limitations
  17. Setup from a fresh clone
  18. Environment variables
- **Voice:** plain, short sentences, first person plural ("we"). No emojis, no "seamless", "robust", "leverage", "cutting-edge" or "revolutionary". Every number has a source or a "measured on" date. It should read like the team wrote it, because the team will be questioned on it.
- Keep `docs/decisions.md` going: one dated entry per real decision, with the reason and what we rejected.

---

## 21. Work packages

Each package lists P0 then P1. Each ends with `docs/qna/<name>.md` and the five-question check.

### Step 0 + WP-A: Aryaveer (backend lead, data, security, reviews)

- **P0 Step 0** (section 4), then `CLAUDE.md`, CI skeleton and the deploy workflow.
- **P0 A1: `withApi()` foundation.** Problem+json errors, request ids, pino logging, zod helpers, auth/role guard, Origin check, body limits, JSON 404/405 for `/api/*`. **Merge this first (aim: by 25 Nov 11:00).** Everyone builds on it.
- **P0 A2: Clerk ↔ Supabase** third-party auth, server Supabase client with the Clerk token, `server-only` admin client.
- **P0 A3: migrations** in section 7, RLS, RLS tests, `db:types`.
- **P0 A4: roles.** Onboarding endpoint, admin role endpoint, audit log function, `proxy.ts` route protection.
- **P0 A5: security.** CSP, extra headers, gitleaks, npm audit, bundle secret grep, `docs/security.md`.
- **P0 A6: risk job.** `reason_code` + `reason_params` in `run_risk.py`, with pytest cases.
- **P0 A7: health and readiness.** `/health`, `/health/ready`, stale flag; post-deploy smoke test; Container Apps scaling settings. P1: Sentry and an uptime check (section 15).
- **P1 A8: backtest.** `jobs/backtest.py` runs the rules on archived Open-Meteo weather for each verified incident (T−48/−24/−12 h) and reports hit rate, lead time and false alarms over the window, with honest caveats. Output goes to `docs/backtest.md` and `GET /api/v1/model`.
- Review every PR within a few hours. You are the bottleneck; keep PRs flowing.

### WP-B: Madhusudan (field data, reports, police updates, alerts)

- **P0 B1: `incidents.csv`.** Rebuild with the section 14 columns, fix the 6 rows, add verified rows (the second verifier is Navaya), validator + CI, migration, update `seed.js`.
- **P0 B2: reports API.**
  - Create: multipart, magic bytes, EXIF strip, corridor check, idempotency.
  - Confirm, flag and list; dedupe; expiry; trust rules (section 9); rate limits.
- **P0 B3: official updates and road status.** Admin/police form and API: source required, versioning, soft delete with reason, audit. The "not official" disclaimer component.
- **P0 B4: queue and worker.** `pgmq` queue + worker endpoint + scheduler + dead-letter view.
- **P0 B5:** `docs/guardrails.md` and `docs/verification.md`.
- **P1 B6: Web Push.** Subscriptions, zone matching, fan-out through the queue, an opt-in screen.

### WP-C: Navaya (map, risk read path, priority score)

- **P0 C1: map fixes.** Overflow at 360/375 px (L1), worst-zone logic (L2), header and heading fixes (L3). Report markers by status (solid for verified/police, dashed for unconfirmed) with a legend. Hazard layer filter wired to real data.
- **P0 C2: risk read path.** `GET /api/v1/risk`, `/zones`, `/risk/summary` (with Aryaveer for wording) with query validation, ETag/304, cache headers, in-memory + Redis cache, load test numbers in README, `docs/scaling.md` read-path section.
- **P0 C3: shared rate-limit store** (Redis, or a Postgres fallback) used by `withApi()`.
- **P0 C4: priority module** `src/shared/priority.ts` (Navaya also owns the advice engine, E1, that uses it):
  - spoilage curve per variety and CA flag; value from a configurable ₹/kg with a source note;
  - output as a band plus the inputs (L13);
  - assumptions in `config/advice-assumptions.json` with `version` and notes.
- **P1 C5:** H3 cells and slope if the corridor CSVs are ready (`/api/v1/risk/hexes`).
- **P1 C6:** Hindi/Urdu map labels.

### WP-D: Riya (UI/UX, languages, offline, frontend tests)

- **P0 D1: languages.** `next-intl` cookie setup, full EN/HI/UR messages for every screen and every API error, RTL, fonts, `<bdi>`/Intl formatting (L4), key-parity CI check, `messages/REVIEW.md`. Get a fluent Hindi and a fluent Urdu reader to review safety text (ask the team who; Aryaveer is from Ramban).
- **P0 D2: sign-in.** Localised email-code sign-in (section 8), copy matching what we really use (L5), onboarding role picker, footer disclaimer, `/privacy` page.
- **P0 D3: offline.** Service worker policy update (L15), IndexedDB outbox with idempotency keys, private-data wipe on sign-out, stale/offline banners, update prompt, `docs/offline.md`.
- **P0 D4: screens.** Agent board (status, last seen, ETA, delay, advice snapshot), report screen (photo, GPS, consent, queued state), admin pages (roles, official updates, reports, road status, audit log, dead letters), all at 360 px.
- **P0 D4b: live board.** The agent board updates without a refresh through Supabase Realtime (`postgres_changes` on `shipments`). The client passes the Clerk token with `supabase.realtime.setAuth()` so RLS limits each agent to their own trucks. The PPT promised a "live board", and the rubric names real-time features under Innovation. Aryaveer checks the RLS side. P1: the same for new reports on the map.
- **P0 D5: Playwright.** Mobile tests (section 18) and Lighthouse numbers.
- **P1 D6:** Aadhaar consent and scanner screens (with Aryaveer).

### WP-E: advice engine, API docs, tests, demo (split 26 Nov 2026: E1 Navaya, E2 Madhusudan, E3–E7 Aryaveer)

- **P0 E1: advice.** `src/shared/decide.ts` used by both `POST /api/v1/advice` (called when online) and the phone (offline fallback), aware of road status for Mughal Road and rail (L12, L14). A test feeds the same inputs to both paths and expects the same answer. Delay estimate for the board. Answers return `reason_code` for translation.
- **P0 E2: API docs.** OpenAPI from zod + `/api/docs` (self-hosted Swagger UI) + spec coverage check. Postman collection with tests for every error case; newman in CI.
- **P0 E3: Vitest setup and suites** (section 18), coverage report in CI, error-path API tests.
- **P0 E4: performance.** Load script and Lighthouse runs (with Navaya and Riya); numbers in README.
- **P0 E5: demo.** `scripts/seed-demo.ts`, the "Try it" table, `docs/demo-script.md`, `docs/qna/README.md` (shared Q&A bank), `docs/runbook.md` (with Aryaveer), rehearsal checklist.
- **P0 E6: README assembly.** Each owner writes the README section for their own work. Aryaveer puts them together in the section 20 order, checks every number has a source or a "measured on" date, and removes anything that sounds like marketing.
- **P1 E7:** Aadhaar Secure QR verifier (section 11): pure functions, synthetic test vectors, endpoint behind the flag. Aryaveer reviews it line by line.

**Hand-offs:**
- A1 → everyone.
- A3 → B2, D4.
- C4 → E1.
- E2 needs every route's zod schema. Write the schema first, then the handler.
- B4 → B6.
- D3 needs the finished report API from B2.

---

## 22. Timeline (round on 26–27 Nov)

| When | What |
|---|---|
| **Tue 24 Nov, night** | Step 0 merged. Clerk dashboard steps done. Aryaveer creates the Project board; each member creates and assigns the issues for their own package. B1 CSV verification starts (no code needed). D1 string inventory from the live app. E5 demo script draft. Everyone: clone, `npm ci`, run locally, set `git config user.email`. |
| **Wed 25 Nov, by 11:00** | A1 `withApi()` merged. A2/A3 migrations reviewed and applied. |
| **Wed 25 Nov, 11:00–20:00** | All P0 packages in parallel, small PRs, reviewed and merged as they land. Deploy `main` after each merge batch; smoke test runs. |
| **Wed 25 Nov, 20:00** | P0 cut-off. Anything unfinished is cut and listed as a limitation; don't half-merge. P1 only if all P0 is green. |
| **Wed 25 Nov, 23:00** | Feature freeze. Seed demo data. Data backup. README numbers filled in. |
| **Thu 26 Nov, morning** | Two full rehearsals on a real Android phone (once in airplane mode). Q&A drill: each member answers the six live-evaluation questions about their own code. Only bug-fix PRs after this. |
| **Round** | All four present. App warmed up (open it and call `/api/v1/health/ready`) a few minutes before we present. Phone hotspot and the screen recording ready. |

---

## 23. Demo script and Q&A prep (P0)

**`docs/demo-script.md`**: a 5-minute run, with a speaker for each part:
1. **Aryaveer, 20 s.** The problem in one line: apples, one road, the warning comes too late.
2. **Riya.** Open the app in Urdu, switch to Hindi, then English. Point out RTL and the "not official" footer.
3. **Navaya.** Map and 48 h strip: reason and confidence, how risk is computed once an hour, the 304 response in DevTools.
4. **Navaya.** The advisor gives HOLD. Run the same request in Swagger and get the same answer. Turn on airplane mode; the same answer comes from cache.
5. **Madhusudan.** The demo driver files a landslide report offline (queued) → back online → it syncs as "unconfirmed" → a vouched driver confirms → "confirmed" → it shows on the agent's board. The admin posts an official update with its source; show the audit log.
6. **Aryaveer.** In Postman: 401 signed out, 403 for a grower posting an official update, 422 for a bad truck number, 429 on rapid reports. Then the RLS test output.
7. **Navaya/Madhusudan.** Scaling numbers and the queue.
8. Close with one limitation each (below).

**`docs/qna/<name>.md`** (each member): what I built (files), one request I can trace, one test I wrote and what it proves, one design decision and what we rejected, one limitation and how I'd fix it.

**Shared answers to prepare** (`docs/qna/README.md`):
- Why rules, not ML? About 10 documented closures, and the rules are explainable; ML only if it beats the rules in the backtest.
- Why no rerouting? There is no heavy-truck bypass in the Ramban gorge.
- How do we stop fake reports? Verification levels, two confirmations, expiry, flags, rate limits, audit.
- What if the hourly job fails? `check_run.py` fails the run, the app shows a stale banner, `/ready` says stale.
- Where are secrets? Env vars backed by Container Apps secrets; never in git; CI checks the bundle.
- What does the Aadhaar check prove, and what doesn't it?
- What changed since Round 1, and why is it within 15%?

**Limitations to own:**
- The incident history is small and incomplete.
- The thresholds are starting values.
- GPS can be spoofed.
- Clerk runs as a development instance.
- No read replicas.
- Translations are reviewed by team members, not professionals.
- The Aadhaar check (if shipped) has no holder binding and is not OVSE-registered.

---

## 24. Final checklist (maps to the score sheet)

- [ ] **Working backend:** every screen uses `/api/v1`, no mock data; main flow (advice → save lot → board; report → confirm) works on a phone. *(S1)*
- [ ] **Structure:** routes / controllers / services / repositories / schemas folders, explained in the README. *(S2)*
- [ ] **Data:** zod + DB constraints, edge cases tested, verified incidents, demo seed with "Try it" accounts. *(S3)*
- [ ] **Reliability:** secrets only in env/Container Apps secrets, `.env.example` complete, problem+json errors, structured logs with request ids, health/ready, stale banner. *(S4)*
- [ ] **Testing:** Vitest + pytest + API integration + Playwright + newman all green in CI; p95 and Lighthouse numbers in README. *(S5)*
- [ ] **Innovation:** explainable 48 h forecast with uncertainty, offline-first with idempotent sync, three languages with RTL, verified reports with trust rules, queue-driven alerts. *(S6)*
- [ ] **Demo:** script rehearsed twice, airplane-mode tested on a real phone, fallback ready. *(S7)*
- [ ] **Security:** login, roles, protected routes, 401/403/422/429 shown in Postman, SQL injection and XSS tests, CSP enforced, audit log, guardrails doc. *(S8)*
- [ ] **Contributions:** every member has merged PRs from their own account, issues assigned, `docs/qna/<name>.md` written, commit count above 50 from real work, no squash merges. *(S9 + bonus)*
- [ ] **Scaling:** cache + ETag + queue + autoscaling settings, with numbers, explained in `docs/scaling.md`. *(bonus)*
- [ ] **Change budget:** "Changes since Round 1" table in README and decisions log; nothing outside section 3. *(penalty)*
- [ ] **All four members present.** *(penalty)*

---

## Appendix A: kickoff messages (paste into Claude Code)

**Aryaveer (Step 0 first):**
> Read docs/round3/BUILD_PROMPT.md sections 0–4 and docs/round3/clerk-setup.md. I'm Aryaveer. Start Step 0 in plan mode. Ask me who built the demo app and where its code is before doing anything. After Step 0 is merged we'll do WP-A starting with A1.

**Madhusudan:**
> Read docs/round3/BUILD_PROMPT.md sections 0–3, then 9, 10, 14, 17 (queue part) and WP-B. I'm Madhusudan. Start with B1 (incidents.csv) in plan mode. For every row, open the source with me and fill the evidence columns. Don't fill any number the source doesn't state.

**Navaya:**
> Read docs/round3/BUILD_PROMPT.md sections 0–3, then 1.4, 6, 12 (RTL part), 17 and WP-C. I'm Navaya. Start with C1 in plan mode. Reproduce the 375 px overflow in a Playwright test first, then fix it.

**Riya:**
> Read docs/round3/BUILD_PROMPT.md sections 0–3, then 8, 10, 12, 13 and WP-D. I'm Riya. Start with D1 in plan mode. List every user-facing string in the app first, then set up next-intl with a cookie, no locale routing.

---

## Appendix B: incident leads to verify (not facts yet)

Verify each one under section 14 before it goes in the CSV. I read the first few myself; numbers in quotes are what the article says.

| Lead | What I saw | Link |
|---|---|---|
| Navyug tunnel snow, 2026 | Greater Kashmir, 27 Jan 2026: NH-44 closed "on Monday" (26 Jan) due to fresh snow "in and around the Navyug Tunnel"; no vehicle count | [GK](https://m.greaterkashmir.com/article/jammu-srinagar-nh-44-closed-due-to-fresh-snowfall-near-navyug-tunnel/473014) |
| Snow closure 23–24 Jan 2026 | ETV Bharat 24 Jan; GK "partially restored after two days" | [ETV Bharat](https://www.etvbharat.com/en/bharat/snow-shuts-srinagar-jammu-highway-other-key-kashmir-roads-vande-bharat-train-remains-operational-enn26012401721), [GK](https://m.greaterkashmir.com/article/jammu-srinagar-highway-partially-restored-for-traffic-after-two-days/472347) |
| Digdol and others, Apr 2026 | Lokmat Times, 9 Apr 2026: blocked "early Monday" (6 Apr) by landslides at Shalgarhi, Banihal, Digdol, Khooni Nallah, Karol Bridge, Chanderkote; reopened for a few hours Tuesday, closed again, traffic resumed Thursday 9 Apr; "over 900 vehicles" cleared (cleared, not stranded) | [Lokmat](https://www.lokmattimes.com/national/srinagar-jammu-national-highway-reopened-after-3-days), [AIR 8 Apr](https://www.newsonair.gov.in/jk-nh44-closed-after-massive-landslide-in-banihal) |
| Aug–Sep 2025 closure | Our PPT refs [2], [3], [4], [5]: Down To Earth 18 Sep 2025 (2-week closure), Tribune 23 Sep 2025, Greater Kashmir 28 Oct 2025, Deccan Herald 21 Sep 2025 | from slide 18 |
| Snow + landslides, 12 Mar 2020 | PTI headline "Jammu-Srinagar NH closed due to snowfall, landslides" (not yet read) | [Business Standard/PTI](https://www.business-standard.com/article/pti-stories/jammu-srinagar-nh-closed-due-to-snowfall-landslides-120031200519_1.html) |
| Udhampur landslide, Jul 2026 | AIR 27 Jul 2026 headline (not yet read) | [AIR](https://newsonair.gov.in/fresh-landslide-disrupts-traffic-on-jammu-srinagar-highway-in-udhampur/) |
| Ramban, six-hour closure | Tribune headline "Landslide closes highway for six hours at Ramban" (date not checked) | [Tribune](https://www.tribuneindia.com/news/j-k/landslide-closes-highway-for-six-hours-at-ramban-50386) |
| Snow + landslides, "300 vehicles stranded" | Tribune headline (date not checked) | [Tribune](https://www.tribuneindia.com/news/j-k/snowfall-landslides-shut-jammu-and-kashmir-highway-300-vehicles-stranded-229343) |

Corrections for the existing rows are in section 1.5.

---

## Appendix C: `CLAUDE.md` to add at the repo root

```markdown
@AGENTS.md

# RouteGuard: rules for every Claude Code session

- The plan for Round 3 is docs/round3/BUILD_PROMPT.md. Read sections 0–3 before any work.
- Never read, print, log or commit .env files or keys. Only .env.example is committed.
- Server-only secrets live in modules that start with `import "server-only"`.
- Next.js 16: read node_modules/next/dist/docs/ before using a Next API. proxy.ts, async auth(), async params.
- Every API route goes through withApi() and returns problem+json on errors.
- Validate every input with zod (.strict()). Never put user input into Supabase .or()/.filter()/.textSearch() strings.
- No dangerouslySetInnerHTML. No invented numbers in UI, docs or data.
- RouteGuard is advisory and not an official police service. Keep the disclaimer.
- Hosting is Azure Container Apps on Azure for Students. No Vercel. Spend the credit carefully: no new Azure resource without asking (section 4.1).
- Small Conventional Commits from the member at the keyboard. Never squash-merge, never fake authorship.
- Ask before migrations on the real database, Clerk app changes, deploys, deletes or anything with personal data.
```
