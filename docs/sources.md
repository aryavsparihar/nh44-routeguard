# Sources

Where each fact the app shows comes from. Add a row before showing anything new.

| What | Source | Checked |
| --- | --- | --- |
| Emergency number 112 | India's Emergency Response Support System (ERSS), the single national emergency number | 25 Nov 2026 |
| TCU / J&K Traffic Police helpline | Not shown: we have not verified a number on an official J&K Traffic Police source. The app tells people to follow J&K Traffic Police instructions and links 112 | 25 Nov 2026 |
| Past closures | `data/incidents.csv`: one row per closure with its source URL, publisher, a short quote and who verified it | per row (`verified_on`) |
| Weather | Open-Meteo forecast API, and ERA5 archive for the backtest | each run |
| Risk thresholds | Our starting values in `lib/risk/config.json` (`docs/risk-model.md`) | 25 Nov 2026 |
| Advice assumptions (spoilage, value) | Our starting values in `config/advice-assumptions.json`, with notes | 25 Nov 2026 |
| Report rules (expiry, confirmations, duplicates) | Team decisions in `config/report-rules.json` (BUILD_PROMPT section 9) | 25 Nov 2026 |
