# Supabase (Postgres, Storage, Realtime, Queues, pg_cron, CLI)

**In one line:** Supabase is our hosted database (Postgres in Mumbai), plus file storage, live updates and background jobs, all in one free project.

## What it is

Supabase is a service built around a **PostgreSQL** database. Around it come extras we use:

| Part | What it is | What we use it for |
| --- | --- | --- |
| **Postgres** | The database | Every table: zones, risk scores, reports, shipments, users, audit log ... |
| **PostGIS** | Map extension for Postgres | Points and distances ([postgis.md](postgis.md)) |
| **Storage** | File storage with access rules | Report photos, in the private bucket `report-photos` (WebP only, 2 MB max) |
| **Realtime** | Live messages over a WebSocket | The `map` channel tells open maps "new report or update, reload"; `board-shipments` sends shipment changes to the board |
| **Queues (pgmq)** | A job queue inside Postgres | The `jobs` queue for alerts after a report or an official update |
| **pg_cron** | A timer inside Postgres | Starts the risk job, wakes the job worker, cleans old data |
| **pg_net** | HTTP calls from Postgres | pg_cron uses it to call GitHub ("run the risk job now") and our worker |
| **Vault** | Encrypted secret storage | The GitHub token pg_cron uses |
| **CLI** | Command-line tool (`supabase` 3.x) | Apply migrations, generate types, run SQL |

## Why we use it

- Free tier, one project, in Mumbai (close to Jammu and Kashmir).
- Real Postgres, so we get Row Level Security, PostGIS and SQL functions.
- Storage, Realtime, a queue and a timer without a new server or a new Azure resource.
- It accepts Clerk's sign-in token directly.

## Where it is in our project

| Path | What it holds |
| --- | --- |
| `supabase/migrations/` | Every database change, as SQL files applied in order (29 so far) |
| `supabase/tests/rls.test.sql` | pgTAP tests for the security rules ([pgtap.md](pgtap.md)) |
| `supabase/config.toml` | Project settings for the CLI |
| `lib/database.types.ts` | TypeScript types generated from the database |
| `src/ui/board/useShipments.ts` | Subscribes to the `board-shipments` Realtime channel |
| `src/ui/risk/useMapSignal.ts` | Listens on the `map` channel |

## Timers (pg_cron)

| Job | When | What |
| --- | --- | --- |
| `risk-job-dispatch` | :07 and :37 every hour | Asks GitHub to run the risk job; :37 is a retry that skips if :07 worked |
| `jobs-worker` | every minute | Wakes the job worker, only if a job is due |
| `rate-limits-cleanup` | :23 every hour | Deletes old rate-limit counters |
| `shipment-location-cleanup` | 03:41 every day | Clears old truck locations |

## Commands

```bash
npx supabase db push --remote          # apply new migrations (ask the team first)
npm run db:types                       # regenerate lib/database.types.ts
npm run db:schema                      # regenerate the Drizzle schema
npm run db:test                        # run the pgTAP tests (all rolled back)
```

## Learn more

- https://supabase.com/docs
- https://supabase.com/docs/guides/queues
- https://supabase.com/docs/guides/cron

## Questions you may be asked

**Q: Why Supabase and not Firebase?**
A: Supabase is real Postgres: tables, SQL, Row Level Security and PostGIS for map data. Firebase is a document store with no SQL and no PostGIS.

**Q: Where is the data stored?**
A: In Supabase's Mumbai region, in India.

**Q: How does the map update live?**
A: After any new report or official update, a database trigger sends a tiny "changed" message on the Realtime `map` channel. Open maps then reload the data from our API. The message carries no data itself, and maps also reload every minute in case a message is missed.

**Q: Why a queue in Postgres instead of Redis?**
A: pgmq is free and already in our database. The job is added in the same transaction as the report, so a report can never be saved without its job, or the other way round.

**Q: What happens if a background job keeps failing?**
A: It's tried 5 times (30, 60, 90, 120 seconds apart), then moved to the dead letters, which TCU can see at `/admin/jobs`.

**Q: What is a migration?**
A: A numbered SQL file that changes the database. Every copy of the database runs the same files in the same order, so they all end up the same.
