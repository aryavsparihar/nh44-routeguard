# What "verified" means

One meaning everywhere: in the database, the API, the app and this doc.

## People

The level is `users.verification_level` (enum in `supabase/migrations/20261124160001_enum_values.sql`). Each raise adds a row to `verifications` with its method.

| Level | How you get it | What it unlocks |
| --- | --- | --- |
| `none` | Signed up, nothing checked yet | Read the map and advice |
| `email` | Clerk email code | Sign in, save lots, flag reports |
| `agent_vouched` | Your transport agent vouches for you after you accept their invite (`POST /api/v1/agents/drivers/{id}/vouch`) | Your reports go live as "verified driver" |
| `aadhaar_qr` | Optional, behind `FEATURE_AADHAAR_QR`: drivers and agents scan the Secure QR on their Aadhaar card or e-Aadhaar on `/me`; UIDAI's signature checks out on our server against a pinned certificate and the name matches the profile exactly | Same as `agent_vouched`. Never required |
| `official` | An admin grants police or admin with a written reason | Post official updates |

If a driver moves to a different agent, an `agent_vouched` level drops back to `none`: the new agent has to vouch again (`supabase/migrations/20261125180000_shipments_fleet.sql`).

## The Aadhaar QR check

`POST /api/v1/verify/aadhaar-qr` (`src/server/aadhaar/`), 5 tries an hour.

1. The phone reads the QR with the camera (the browser's `BarcodeDetector`, or `jsQR` where that is missing) or from a picture chosen on the phone. Frames and pictures stay on the phone; only the QR's digits are sent.
2. The server turns the digits into bytes, unzips them (refusing anything over 64 KB, so a zip bomb can't use up memory), and checks the RSA-SHA256 signature in the last 256 bytes against the certificates pinned in `config/uidai/certs.json`. Each entry's SHA-256 fingerprint is checked before the key is used.
3. It reads the reference field (the last 4 digits of the Aadhaar number) and the name, and compares the name with the profile name: the same after removing case, spaces and punctuation → `verified`; close (another word order or one typo) → `manual_review`; otherwise `rejected`.
4. `private.record_aadhaar_check()` stores the verdict, the last 4 digits (none for a rejection), the consent version and the certificate version, writes the audit log and, only for `verified`, raises the level to `aadhaar_qr`. Official accounts keep their level.

Never stored or logged: the QR, the name, date of birth, gender, address, photo, email or mobile hash. Nobody is asked to type an Aadhaar number and no card picture is uploaded.

**Demo key.** No real Aadhaar card is used on stage or in screenshots. `scripts/aadhaar/make-demo-qr.mjs` made a key pair, pinned its public half as a `test: true` entry, made `docs/demo/aadhaar-demo-qr.png` for "Demo driver (not vouched)", and threw the private key away. Test entries count only with `AADHAAR_ALLOW_TEST_CERT=true`, and the result then says "Demo check (test key)". UIDAI's pinned certificates and how to add a new one: [runbook](runbook.md#aadhaar-qr).

`manual_review` is stored but no admin screen lists it yet; the person sees why and can fix their profile name and scan again.

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
