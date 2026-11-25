# Python risk job (httpx, python-dotenv)

**In one line:** a Python script runs once an hour, fetches the weather, scores the closure risk for every zone and hexagon, and saves the scores for the app to read.

## What it is

A Python 3.12 program in `jobs/`. It uses only three libraries: **httpx** (web requests), **python-dotenv** (reads a local `.env` for testing) and **h3** (hexagons). It runs on GitHub Actions, not on our Azure server.

## Why we use it

- **Compute once, read many.** Risk is scored once an hour for everyone. One user and 10,000 users cost the scoring job the same, and the app only reads stored rows.
- Python is a good fit for data work and the backtest.
- Running it on GitHub Actions costs nothing and needs no new Azure resource.

## Where it is in our project

| Path | What it does |
| --- | --- |
| `jobs/run_risk.py` | The hourly job: fetch, score, save |
| `jobs/check_run.py` | Runs right after: fails the run if any zone or horizon is missing or old |
| `jobs/risk/openmeteo.py` | One Open-Meteo forecast call for all points |
| `jobs/risk/triggers.py`, `scoring.py` | The rules |
| `jobs/risk/db.py` | Saves rows through Supabase's REST API with the secret key |
| `jobs/backtest.py` | Tests the rules against real past closures |
| `jobs/replay.py` | Builds the "replay a past closure" data for the map |
| `jobs/points.json` | The weather points along NH-44 |
| `lib/risk/config.json` | Exposure table and thresholds, shared with the app |
| `.github/workflows/risk-job.yml` | Runs the job |
| `docs/risk-model.md` | The full model in words |

## How the model works

For each of the **6 zones**, **4 hazards** (landslide, rockfall, flash flood, snow and ice) and **4 horizons** (now, +12 h, +24 h, +48 h):

```
score = exposure(zone, hazard) × trigger(weather, hazard)
```

- **Exposure** (0 to 1): how prone that stretch is to the hazard. A fixed table.
- **Trigger** (0 to 1): how strong the weather signal is (rain, snowfall, snow depth, temperature).
- The worst weather point in the zone decides the zone's score.
- Level: **low** below 0.30, **medium** from 0.30, **high** above 0.65.

All thresholds and exposure values are **our own starting values, not sourced figures**, and `docs/risk-model.md` says so.

## When it runs

- Supabase pg_cron asks GitHub to start it at **:07 and :37** every hour. The :37 call skips if the last run is under 40 minutes old, so it only acts as a retry.
- GitHub's own schedule (`7 * * * *`) stays as a fallback. It's not reliable on its own: in November 2026 it often ran only every 6 to 12 hours.

## Commands

```bash
pip install -r jobs/requirements.txt
python jobs/run_risk.py --dry-run     # fetch, score and print; writes nothing, needs no key
python -m pytest jobs/tests -q        # the Python tests
```

## Questions you may be asked

**Q: Is this machine learning?**
A: No. It's a set of clear rules (exposure × trigger), so every score can be explained with a reason code. We test the rules against past closures in the backtest.

**Q: Where do the thresholds come from?**
A: They are our own starting values, not sourced figures, and we say so. They live in one file, `lib/risk/config.json`, so they can be tuned.

**Q: Why not score the risk when a user opens the app?**
A: Weather changes hourly, not per request. Scoring once an hour keeps the app fast and cheap.

**Q: What if the job fails?**
A: `check_run.py` turns the run red if rows are missing. The :37 call retries. The app shows how old the data is and warns when it's over 90 minutes.

**Q: Why GitHub Actions and not a server cron?**
A: It's free, logs every run, and keeps the secret key off our web server.
