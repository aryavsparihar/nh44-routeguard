# What "verified" means

One meaning everywhere: in the database, the API, the app and this doc.

## People

The level is `users.verification_level` (enum in `supabase/migrations/20261124160001_enum_values.sql`). Each raise adds a row to `verifications` with its method.

| Level | How you get it | What it unlocks |
| --- | --- | --- |
| `none` | Signed up, nothing checked yet | Read the map and advice |
| `email` | Clerk email code | Sign in, save lots, flag reports |
| `agent_vouched` | Your transport agent vouches for you after you accept their invite (`POST /api/v1/agents/drivers/{id}/vouch`) | Your reports go live as "verified driver" |
| `aadhaar_qr` | P1, behind `FEATURE_AADHAAR_QR`: the Secure QR signature checks out on our server and the name matches your profile | Same badge, stronger. Never required |
| `official` | An admin grants police or admin with a written reason | Post official updates |

If a driver moves to a different agent, an `agent_vouched` level drops back to `none`: the new agent has to vouch again (`supabase/migrations/20261125180000_shipments_fleet.sql`).

## Reports

The numbers live in `config/report-rules.json` (versioned, with a note on where each came from).

- From a verified driver, police or admin: shown at once with a solid marker.
- From anyone else: "unconfirmed", dashed marker.
- **Confirmed** when 2 other verified users within 2 km confirm it within 3 h, or police/admin confirms it.
- **Expiry by type:** landslide, rockfall and flash flood 6 h; snow/ice 12 h; accident 3 h; other 3 h. Expired reports leave the map but stay in history.
- **Duplicates:** the same hazard within 500 m and 60 min becomes a confirmation of the first report, not a new pin.
- **Flags:** 3 flags from different users hide an unconfirmed report until an admin looks at it.
- The risk job raises confidence only from **confirmed** reports and official updates.

## Official updates

Each has a source link, an issue time and an expiry. Shown as "From J&K Traffic Police advisory · source · time". Edits make a new version; deletes are soft with a reason; everything is in the audit log. See [guardrails.md](guardrails.md).

## Data

`data/incidents.csv` follows BUILD_PROMPT section 14: each row has its sources and who checked it. `scripts/validate_incidents.py` runs in CI. Thresholds and advice assumptions live in `config/` with notes.

## Translations

Safety text (SEND/HOLD/RAIL/DIVERT, warnings, disclaimers, consent screens) is checked by a fluent Hindi reader and a fluent Urdu reader, logged in `messages/REVIEW.md` with name and date. Strings nobody has reviewed yet are listed there as "not yet reviewed".

## Builds

After every deploy, `scripts/smoke.mjs` hits `/api/v1/health/ready`, `/api/v1/risk` and the home page, and fails the workflow if any is wrong.
