// The model card for GET /api/v1/model: what the risk model is, from the same
// settings file the hourly job reads (lib/risk/config.json), plus the
// backtest results written by jobs/backtest.py (lib/risk/backtest.json).
// Nothing here is typed in by hand, so the API can't drift from the job.
import backtest from "@/lib/risk/backtest.json";
import config from "@/lib/risk/config.json";

const HAZARDS = ["landslide", "rockfall", "flash_flood", "snow_ice"] as const;

export function modelCard() {
  return {
    model_version: config.model_version,
    kind: "rules",
    hazards: HAZARDS,
    horizons_hours: config.horizons_hours,
    levels: { medium_from: config.levels.medium_from, high_above: config.levels.high_above },
    thresholds_note: config._note,
    advisory: "RouteGuard is advisory and not an official police service.",
    backtest,
  };
}
