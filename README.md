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

Phase 0 (setup) is done: the app, database and deploys are connected. The home page is a placeholder that shows how many highway zones it can read from the database.

## Tech stack

| Part | Tool |
| --- | --- |
| Web app | Next.js 16 (App Router, TypeScript, Tailwind) |
| Hosting | Vercel (Mumbai region). Every PR gets its own preview link |
| Database | Supabase Postgres + PostGIS (Mumbai, `ap-south-1`) |
| Risk model | Python job in `jobs/`, to run hourly on GitHub Actions (Phase 1) |

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
| `risk_scores` | Model output per cell or zone, for 0/12/24/48 hours ahead |
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

## Repo layout

| Folder | What lives there |
| --- | --- |
| `app/` | Next.js pages |
| `lib/supabase/` | Supabase clients (browser + server, publishable key only) |
| `lib/database.types.ts` | Generated database types. Don't edit by hand |
| `lib/risk/` | Risk score types |
| `jobs/` | Python hourly risk job (`run_risk.py`, `requirements.txt`) |
| `supabase/` | Supabase config and migrations |
| `data/` | Team CSVs |

## Working together

1. Work on a branch in your fork and open a PR to `main` on this repo.
2. Check the Vercel preview link that appears on your PR.
3. Aryaveer reviews and merges. Merging to `main` updates the live site.
