# Sources

Where each fact the app shows comes from. Add a row before showing anything new.

| What | Source | Checked |
| --- | --- | --- |
| Emergency number 112 | India's Emergency Response Support System (ERSS), the single national emergency number | 25 Nov 2026 |
| TCU / J&K Traffic Police helpline | J&K Traffic Police website : https://trafficpolice.jk.gov.in/contact.html Traffic Police Control Units. Jammu: 0191-2451192, 0191-2459048, 9419147732, 103. Ramban: 9419993745. Udhampur: 8491928625. Srinagar: 0194-2455164, 0194-2450022, 01942485396, 103. | 25 Nov 2026 |
| Past closures | `data/incidents.csv`: one row per closure with its source URL, publisher, a short quote and who verified it | per row (`verified_on`) |
| Weather | Open-Meteo forecast API, and ERA5 archive for the backtest | each run |
| Risk thresholds | Our starting values in `lib/risk/config.json` (`docs/risk-model.md`) | 25 Nov 2026 |
| Advice assumptions (spoilage, value) | Our starting values in `config/advice-assumptions.json`, with notes | 25 Nov 2026 |
| Report rules (expiry, confirmations, duplicates) | Team decisions in `config/report-rules.json` (BUILD_PROMPT section 9) | 25 Nov 2026 |
