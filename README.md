# NH-44 RouteGuard

Protecting Kashmir's apple harvest from NH-44 highway closures through AI disruption forecasting, dynamic cold-storage routing, and real-time fleet visibility.

Project Ananta Hackathon · Team 01

**Live:** https://nh44-routeguard.vercel.app

## What it does

NH-44 is the only all-weather road between Jammu and Srinagar, and landslides, rockfall, flash floods and snow close it every season. Apple trucks get stuck for days and the fruit spoils.

RouteGuard predicts closure risk along the highway for the next 0, 12, 24 and 48 hours and tells each apple shipment what to do:

- **Send** – the road looks clear
- **Hold** – wait in cold storage until the risk drops
- **Rail** – put the load on the train instead
- **Divert** – take another route

Drivers and police can also report live hazards from the road.

## Status

Phase 0 is done: the app, database and deploys are connected, and an hourly job scores closure risk for the 6 zones. The home page is still a placeholder; [/status](https://nh44-routeguard.vercel.app/status) shows the latest scores.

## Tech stack

| Part | Tool |
| --- | --- |
| Web app | Next.js 16 (App Router, TypeScript, Tailwind) |
| Hosting | Vercel (Mumbai region). Every PR gets its own preview link |
| Database | Supabase Postgres + PostGIS (Mumbai, `ap-south-1`) |
| Weather | Open-Meteo forecast API (free, no key) |
| Risk model | Python rules in `jobs/`, run hourly on GitHub Actions |

## Getting started

You need Node.js 20 or newer.

1. Fork this repo on GitHub, then clone your fork:
   ```bash
   git clone https://github.com/<your-username>/nh44-routeguard.git
   cd nh44-routeguard
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy the env template:
   ```bash
   cp .env.example .env.local
   ```
   Then fill in the two `NEXT_PUBLIC_` values. Ask Aryaveer for them, or copy them from Supabase → Project Settings → API Keys.
   The URL looks like `https://<project-ref>.supabase.co`, not the `supabase.com/dashboard/...` link in your browser.
4. Start the dev server:
   ```bash
   npm run dev
   ```
   Open http://localhost:3000. You should see **Supabase connected: 6 zones**.

## Environment variables

| Name | Where it goes | What it is |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local`, Vercel | Supabase API URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env.local`, Vercel | Publishable key (safe in the browser, RLS protects the data) |
| `SUPABASE_URL` | GitHub Actions secrets only | Same API URL, for the Python job |
| `SUPABASE_SECRET_KEY` | GitHub Actions secrets only | Secret key. It skips all security rules |

Never commit `.env.local`. Never put the secret key in `.env.local`, Vercel, app code or any `NEXT_PUBLIC_` variable.

## Database

All tables live in Supabase. The SQL is in `supabase/migrations/`.

| Table | What it holds |
| --- | --- |
| `zones` | The 6 highway stretches from Jammu to Srinagar, with length, danger length and starting risk |
| `hexes` | H3 map cells along the highway, with zone, slope and weather point |
| `weather_readings` | Rain, snow and temperature per weather point, observed and forecast |
| `risk_scores` | Model output per zone (or hexagon), for 0/12/24/48 hours ahead |
| `latest_risk` (view) | The newest run's rows from `risk_scores`, with zone names |
| `incidents` | Past closures (from `data/incidents.csv`) |
| `users` | App users: growers, traders, agents, drivers, police, admins |
| `reports` | Live hazard reports from drivers and police |
| `shipments` | Apple trucks being tracked, with status and advice |

### The 6 zones

| # | Stretch | Length (km) | Danger (km) | Risk |
| --- | --- | --- | --- | --- |
| 1 | Jammu → Udhampur (Jakhani) | 65 | 0.5 | low |
| 2 | Udhampur → Chenani–Nashri | 42 | 3.5 | medium |
| 3 | Nashri → Ramban | 28 | 6.5 | high |
| 4 | Ramban → Ramsoo | 22 | 9.5 | extreme |
| 5 | Ramsoo → Banihal → Qazigund | 32 | 6.0 | high |
| 6 | Qazigund → Srinagar | 62 | 0.0 | low |

### Changing the database

Don't edit tables in the Supabase dashboard. Add a migration instead, so everyone stays in sync:

```bash
npx supabase migration new <short_name>   # write your SQL in the new file
npm run db:push                           # apply it (needs access to the project)
npm run db:types                          # refresh lib/database.types.ts
```

## Data files

Put team CSVs in `data/` with these exact column headers.

| File | Columns |
| --- | --- |
| `corridor_hexes.csv` | `h3_index`, `zone_id` |
| `hex_slope.csv` | `h3_index`, `slope_deg` |
| `incidents.csv` | `date`, `zone_id`, `place`, `lat`, `lng`, `hazard_type`, `hours_closed`, `trucks_stranded`, `source_url` |

- `date` is `YYYY-MM-DD`. `zone_id` is 1 to 6.
- `hazard_type` must be one of: `landslide`, `rockfall`, `flash_flood`, `snow_ice`, `accident`, `other`.

## How the risk score works

- Every hour we pull rain, snow, snow depth and temperature for 15 points along NH-44 from Open-Meteo.
- For each zone and hazard (landslide, rockfall, flash flood, snow/ice): **score = exposure × trigger**, both 0–1. Exposure is how prone the stretch is; trigger is how strong the weather is.
- A zone takes its worst point. `overall` is the highest of the 4 hazards, with a range that widens for 12/24/48 h ahead.
- Level: **low** below 0.30, **medium** 0.30–0.65, **high** above 0.65. Confidence goes up when a report or past incidents agree.
- All thresholds are our own starting values in [`lib/risk/config.json`](lib/risk/config.json), to be tuned in the backtest. Full details: [docs/risk-model.md](docs/risk-model.md).

## Hourly job

[`jobs/run_risk.py`](jobs/run_risk.py) fetches the weather (one Open-Meteo call), saves it to `weather_readings`, scores the 6 zones for 0/12/24/48 h and writes 24 rows to `risk_scores`. GitHub Actions runs it at minute 7 of every hour ([`.github/workflows/risk-job.yml`](.github/workflows/risk-job.yml)), then checks the new rows arrived.

Run it on your laptop without any key:

```bash
python3 -m venv jobs/.venv
jobs/.venv/bin/pip install -r jobs/requirements.txt
jobs/.venv/bin/python jobs/run_risk.py --dry-run
```

`--dry-run` fetches and scores, prints a table, and writes nothing. Run the tests with `jobs/.venv/bin/python -m pytest jobs/tests`.

- **Logs:** GitHub → **Actions** → **Risk job** → pick a run. A failed run is red and GitHub emails the repo owner.
- **Latest scores:** [nh44-routeguard.vercel.app/status](https://nh44-routeguard.vercel.app/status)
- **Run it now:** Actions → Risk job → **Run workflow**, or `gh workflow run risk-job.yml`.
- **Weather points:** [`jobs/points.json`](jobs/points.json), found with OpenStreetMap by [`jobs/tools/locate_points.py`](jobs/tools/locate_points.py).

## Risk score format for the app

Read the `latest_risk` view: the newest run's rows, already joined with the zone name. Zone rows have `h3_index = null`; hexagon rows (later) have an H3 index.

```ts
const { data } = await supabase
  .from("latest_risk")
  .select("*")
  .is("h3_index", null)
  .eq("horizon_hours", 0);
```

A real row (zone 5, 48 h ahead, computed from Open-Meteo data on 10 Nov 2026):

```json
{
  "run_at": "2026-11-10T18:27:19+00:00",
  "zone_id": 5,
  "zone_name": "Ramsoo → Banihal → Qazigund",
  "h3_index": null,
  "horizon_hours": 48,
  "landslide": 0.063,
  "rockfall": 0.149,
  "flash_flood": 0.09,
  "snow_ice": 0.0,
  "overall": 0.149,
  "risk_low": 0.0,
  "risk_high": 0.349,
  "level": "low",
  "top_hazard": "rockfall",
  "confidence": "low",
  "reason": "Rockfall: 18 mm rain in 48 h near Navyug tunnel (Banihal side); zone 5 is exposed to rockfall",
  "model_version": "rules-v0.1"
}
```

| Field | Meaning |
| --- | --- |
| `horizon_hours` | 0, 12, 24 or 48 hours ahead |
| `overall` | 0–1, highest of the 4 hazard scores |
| `risk_low`, `risk_high` | Range around `overall` (±0.05 / 0.10 / 0.15 / 0.20 by horizon) |
| `level` | `low` / `medium` / `high`. Use this in the advice table |
| `top_hazard` | `landslide`, `rockfall`, `flash_flood`, `snow_ice`, or `null` if nothing triggers |
| `confidence` | `low` / `medium` / `high` |
| `reason` | One sentence, max 140 characters, safe to show users |

## Repo layout

| Folder | What lives there |
| --- | --- |
| `app/` | Next.js pages (`/status` is our internal check page) |
| `lib/supabase/` | Supabase clients (browser + server, publishable key only) |
| `lib/database.types.ts` | Generated database types. Don't edit by hand |
| `lib/risk/config.json` | Risk model settings shared by the job and the app |
| `jobs/` | Python hourly risk job: `run_risk.py`, `points.json`, `risk/` (rules), `tests/`, `load_hexes.py` |
| `supabase/` | Supabase config and migrations |
| `data/` | Team CSVs |
| `docs/` | [Risk model](docs/risk-model.md) and [decision log](docs/decisions.md) |
| `.github/workflows/` | Hourly risk job and CI (pytest on every PR) |

## Working together

1. Work on a branch in your fork and open a PR to `main` on this repo.
2. Check the Vercel preview link that appears on your PR.
3. Aryaveer reviews and merges. Merging to `main` updates the live site.
