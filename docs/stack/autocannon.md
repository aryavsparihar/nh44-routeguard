# autocannon (load test)

**In one line:** autocannon fires many requests at the API at once to measure how fast it answers under load.

## What it is

autocannon (version 9) is a Node.js load-testing tool. It keeps a number of connections busy for a set time and reports response times and requests per second.

## Why we use it

- To show with real numbers that caching makes the risk API fast.
- It's a small npm package, nothing to install system-wide.

## Where it is in our project

| Path | What it holds |
| --- | --- |
| `scripts/load/risk.mjs` | Hits `GET /api/v1/risk` with 10 connections, 10 s per run |
| `docs/scaling.md` | The results and how they were measured |

## What we measured

On 25 Nov 2026: production build (`next start`) on an Apple M4 laptop, reading the real Supabase database in Mumbai, 10 connections, 10 s per run.

| Run | p50 | p99 | Requests/s | Errors |
| --- | --- | --- | --- | --- |
| Cold first request (one sample, goes to the database) | 1069 ms | | | |
| Warm (200, from the memory cache) | 3 ms | 6 ms | 2980 | 0 |
| Revalidate (304 with the ETag) | 2 ms | 4 ms | 3449 | 0 |

These are for one process on a laptop, **not the deployed app**. The cold number is mostly the trip to Mumbai and the first database connection.

## Commands

```bash
npm run build && npx next start -p 3100
node scripts/load/risk.mjs http://localhost:3100 10
```

## Learn more

- https://github.com/mcollina/autocannon

## Questions you may be asked

**Q: What do p50 and p99 mean?**
A: p50: half the requests were faster than this. p99: 99 out of 100 were faster than this. p99 shows the slow cases.

**Q: Why is it so fast?**
A: Risk is scored once an hour, and each server keeps the last answer in memory for 60 s, so most requests never reach the database. A phone that already has the data gets a 304 with no body.

**Q: Is that how fast it will be on Azure?**
A: No. These are laptop numbers. On Azure the first request after idle also has to start a container. We say so in `docs/scaling.md`.
