# Madhusudan: field data, reports, police updates, alerts (WP-B)

**What I own:** `data/incidents.csv` and its checks (`scripts/validate_incidents.py`, `seed.mjs`), road reports (`src/server/reports/`, `app/api/v1/reports/`), official updates and road status (`src/server/official-updates/`, `src/server/road-status/`), the job queue (`src/server/jobs/`, pgmq migration), Web Push (`src/server/push/`), and the docs `docs/guardrails.md` and `docs/verification.md`.

**A request I can trace:** `POST /api/v1/reports` (multipart) → `withApi()`: signed in, driver/agent/police/admin, 10 reports an hour, `Idempotency-Key` header → zod checks hazard type, GPS point on the NH-44 corridor, 280-character note → `mask.ts` hides phone and truck numbers → `photo.ts` re-encodes the photo to WebP with `sharp` (EXIF gone) → one transaction: insert the report (live at once for verified drivers and police, otherwise "unconfirmed"; a same-hazard report within 500 m and 60 min becomes a confirmation), enqueue a `report.created` job → 201. The worker later sends Web Push to people who follow that zone.

**A test and what it proves:** `src/server/reports/photo.test.ts` builds a JPEG with GPS EXIF, sends it through `photo.ts`, and checks the output has no EXIF and a long side of at most 1600 px. So a photo can never leak where or with what phone it was taken.

**A decision and what we rejected:** the queue is Supabase Queues (pgmq) inside our own Postgres, enqueued in the same transaction as the write. Rejected: Redis or a cloud queue, which costs money and could lose a job if the write commits and the enqueue fails.

**A limitation and the fix:** the incident history has 27 verified rows and is not a complete list of closures. Fix: ask J&K Traffic Police / TCU for their closure log, and keep adding sourced rows with a second verifier.
