# Risk model (rules-v0.1)

> **All thresholds, scores and exposure values on this page are our own starting values, not sourced figures.**
> They live in [`lib/risk/config.json`](../lib/risk/config.json) and will be tuned in the backtest.
> The Python code is in [`jobs/risk/`](../jobs/risk/).

## The idea

For each of the 6 zones, each of 4 hazards, and each horizon (0, 12, 24, 48 h ahead):

```
score = exposure(zone, hazard) × trigger(weather, hazard)
```

- **Exposure** (0–1): how prone the stretch is to that hazard. A fixed table.
- **Trigger** (0–1): how strong the weather signal is in the window that ends at the forecast time.

The zone's score for a hazard is the **highest** across its weather points (the worst spot decides).

## Weather data

- Source: [Open-Meteo forecast API](https://open-meteo.com/en/docs), one call for all points.
- Hourly: `precipitation` (mm), `snowfall` (cm), `snow_depth` (m), `temperature_2m` (°C).
- `past_days=3`, `forecast_days=3`, `timezone=GMT`. We use 3 forecast days, not 2: with 2, a run late in the day can't see 48 h ahead.
- Each hourly value is the total for the hour **ending** at that time. "The 72 h window ending at T" means every hour `t` with `T − 72 h < t ≤ T`.
- Open-Meteo snaps each point to its model grid cell. In the mountains the cell can be a few km away and at a different height than the road.
- Points: [`jobs/points.json`](../jobs/points.json), found with OpenStreetMap and checked to be within 2 km of the NH-44 line.

## Triggers

| Hazard | Trigger | Settings (ours) |
| --- | --- | --- |
| Landslide | Rain in last 72 h, scaled 0 at 10 mm → 1 at 80 mm. **+0.2** if more than 30 mm fell in the last 24 h. Cap 1. | `rain_window_h 72`, `rain_mm_zero 10`, `rain_mm_full 80`, `burst_mm_over 30`, `burst_bonus 0.2` |
| Rockfall | Higher of: rain in last 48 h, 0 at 10 mm → 1 at 50 mm; and **freeze-thaw = 0.7**: some hour in the 48 h window is below 0 °C and at least 10 mm fell in the 24 h before it. | `rain_window_h 48`, `rain_mm_zero 10`, `rain_mm_full 50`, `freeze_thaw_score 0.7`, `freeze_thaw_rain_mm 10`, `freeze_thaw_after_h 24` |
| Flash flood | Heaviest 3-hour rain within the last 24 h, 0 at 5 mm → 1 at 25 mm. | `window_h 24`, `burst_hours 3`, `rain_mm_zero 5`, `rain_mm_full 25` |
| Snow / ice | Higher of: snowfall in last 24 h (0 → 1 at 20 cm); snow depth at T (0 → 1 at 0.3 m); **black ice = 0.6** if below 0 °C at T and the road is wet (any rain/snow in the last 24 h, or snow on the ground). | `snowfall_cm_full 20`, `snow_depth_m_full 0.3`, `black_ice_score 0.6`, `black_ice_wet_window_h 24` |

"Scaled" means a straight line, clamped to 0–1: `min(1, max(0, (x − zero) / (full − zero)))`.

Two windows weren't fixed in the brief, so we picked them: flash flood looks for the heaviest 3 h in the last **24 h**, and black ice counts the road as wet if there was rain/snow in the last **24 h**.

## Exposure table

| Zone | Stretch | Landslide | Rockfall | Flash flood | Snow/ice | Why |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Jammu → Udhampur (Jakhani) | 0.1 | 0.1 | 0.1 | 0.1 | Low-risk zone in the dossier (0.5 km danger). Foothills, four-lane. |
| 2 | Udhampur → Chenani–Nashri | 0.6 | 0.3 | 0.3 | 0.2 | Medium zone (3.5 km danger). Slips on cut slopes are the main issue; the Chenani–Nashri tunnel avoids the high Patnitop snow belt. |
| 3 | Nashri → Ramban | 0.9 | 0.6 | 0.8 | 0.3 | High zone (6.5 km danger). Road along the Chenab gorge with steep side streams (nallahs): landslides and flash floods. |
| 4 | Ramban → Ramsoo | 0.8 | 1.0 | 0.5 | 0.3 | Extreme zone (9.5 km danger, the worst). Known shooting-stone / rockfall spots (Digdol, Battery Chashma, Khooni Nallah). |
| 5 | Ramsoo → Banihal → Qazigund | 0.5 | 0.7 | 0.3 | 1.0 | High zone (6 km danger). Highest stretch, over the Pir Panjal via the Banihal / Navyug tunnel: snow and ice. |
| 6 | Qazigund → Srinagar | 0.1 | 0.1 | 0.1 | 0.1 | Low zone (0 km danger). Flat Kashmir valley floor. |

The "Why" column is our reading of the dossier zone notes. Check it against the dossier wording before the demo.

## From hazard scores to one row

- `overall` = highest of the 4 hazard scores. `top_hazard` = which one (ties go to landslide → rockfall → flash flood → snow/ice). If everything is 0, `top_hazard` is empty.
- **Range**: `overall ± 0.05 / 0.10 / 0.15 / 0.20` for 0 / 12 / 24 / 48 h, clamped to 0–1 → `risk_low`, `risk_high`.
- **Level**: `low` below 0.30, `medium` 0.30–0.65, `high` above 0.65 (matches Mayank's advice table).
- **Confidence**:
  - `high`: a report agrees. That means a confirmed report, or any police update, in the same zone in the last 6 h, for the top hazard.
  - `medium`: history agrees. The `incidents` table has rows for that zone and hazard; if it doesn't, the zone's exposure to that hazard is ≥ 0.6.
  - `low`: forecast only. The 48 h horizon is **always low** unless a report agrees.
- **Reason**: one sentence from the numbers, max 140 characters, e.g.
  `Rockfall: 46 mm rain in 48 h, then below 0 °C near Ramban; zone 4 is very exposed to rockfall`.

Each run writes **24 rows** (6 zones × 4 horizons) to `risk_scores`, with `h3_index` empty and `model_version = rules-v0.1`.

## Hexagons (when the CSVs exist)

If `data/corridor_hexes.csv` (`h3_index`, `zone_id`) and `data/hex_slope.csv` (`h3_index`, `slope_deg`) are both present, every hexagon is scored too:

- weather from the **nearest** weather point to the hex centre;
- exposure from the hex's zone;
- landslide and rockfall × **slope factor** = `min(slope_deg / 35, 1)` (ours).

Load them into the `hexes` table first with `jobs/load_hexes.py`. The job only scores hexes that exist in that table. If the files are missing, it skips hexagons quietly.

## Limits

- **We can't predict a cloudburst at an exact spot.** Weather models are too coarse for that, so flash flood is a *warning that conditions are there*, not a forecast of a specific nallah.
- **Only ~10 documented incidents** so far. That's far too few to train or validate an ML model, so we start with transparent rules that a person can check, and move to ML only once there's enough history.
- Past days in Open-Meteo are model data, not rain-gauge readings.
- Exposure is per zone, so a whole zone gets its worst point's weather.
- Reports and incidents are empty right now, so confidence comes from exposure until they fill up.

## What we'll tune in the backtest

Once `data/incidents.csv` is loaded, replay past weather for each incident date and check:

1. The rain thresholds (10/80 mm landslide, 10/50 mm rockfall, 5/25 mm flash flood) and window lengths.
2. The +0.2 burst bonus and the freeze-thaw / black-ice scores.
3. The exposure table, zone by zone.
4. The level cut-offs (0.30 / 0.65) against how often a "high" day was a real closure.
5. The range widths per horizon.
