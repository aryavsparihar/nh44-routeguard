# Open-Meteo (weather data)

**In one line:** Open-Meteo gives us free hourly weather forecasts, past forecasts and past weather for the points along NH-44.

## What it is

Open-Meteo is a free weather API. It needs no key for non-commercial use. It mixes forecasts from national weather models and returns hourly values as JSON.

## Why we use it

- Free and keyless: nothing to leak, no bill.
- One call can ask for many points at once.
- It also keeps **old forecasts** and **past weather**, so we can test our rules against real past closures.

## The three Open-Meteo APIs we use

| API | Address | Used for |
| --- | --- | --- |
| Forecast | `api.open-meteo.com/v1/forecast` | The hourly job (`jobs/risk/openmeteo.py`) |
| Previous Runs | `previous-runs-api.open-meteo.com/v1/forecast` | Backtest: what the forecast said 2, 1 or 0 days before each hour (from 1 Feb 2024) |
| Archive (ERA5) | `archive-api.open-meteo.com/v1/archive` | Backtest and replay: what the weather actually was |

## What we ask for

- Hourly `precipitation` (mm), `snowfall` (cm), `snow_depth` (m), `temperature_2m` (°C).
- `past_days=3` and `forecast_days=3`, in GMT. Three forecast days so that a run late in the day can still see 48 hours ahead.
- Each hourly value is the total for the hour **ending** at that time.

## Things to know

- Open-Meteo snaps each point to its model grid cell. In the mountains, that cell can be a few km away and at a different height from the road. We say so in `docs/risk-model.md`.
- Our points (`jobs/points.json`) were found with OpenStreetMap and checked to be within 2 km of the NH-44 line.

## Learn more

- https://open-meteo.com/en/docs
- https://open-meteo.com/en/docs/previous-runs-api
- https://open-meteo.com/en/docs/historical-weather-api

## Questions you may be asked

**Q: Why Open-Meteo and not IMD?**
A: Open-Meteo has a free, documented JSON API with hourly data, past forecasts and past weather. That made the backtest possible.

**Q: How accurate is it in the mountains?**
A: Weather models have a grid a few km wide, so a valley road can get the value of a nearby slope. That's one reason RouteGuard is advice, not an official road status.

**Q: What is ERA5?**
A: A "reanalysis": the best estimate of what the weather actually was, made after the fact by the European weather centre (ECMWF). We use it to replay past closures.

**Q: What's the difference between the backtest's two checks?**
A: The forecast check uses the forecasts that existed before the closure (could we have warned?). The "weather on the day" check uses ERA5 (do the rules recognise the weather that came with it?).
