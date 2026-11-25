# Our tech stack, one page per tool

Every tool, library and service RouteGuard uses, explained in plain words. Each page has the same parts:

- **What it is**, in one or two lines
- **Why we use it**: the reason we picked it
- **Where it is in our project**: the files to open
- **How it works in RouteGuard**: what it actually does for us
- **Commands** you will run
- **Questions you may be asked**, with short answers to practise

Versions are the ones in `package.json`, `jobs/requirements.txt` and the `Dockerfile` on 26 Nov 2026.

## How the pieces fit

```text
Phone browser (PWA, works offline)
  Next.js pages + React + Tailwind, in English / Hindi / Urdu (next-intl)
  MapLibre map with OpenFreeMap tiles and H3 hexagons
  Service worker + IndexedDB keep the last data and queue reports offline
        |
        |  HTTPS: /api/v1/...  (every route goes through withApi + zod)
        v
Next.js server (Node 24, in a Docker container; Azure Container Apps planned)
  Clerk checks who you are; pino writes logs; sharp cleans photos;
  web-push sends alerts; OpenAPI/Swagger describe every route
        |
        |  SQL as the caller (Drizzle + postgres.js), Row Level Security
        v
Supabase (Postgres in Mumbai)
  PostGIS for map points, Storage for photos, Realtime for live updates,
  pgmq queue + pg_cron timer for background jobs, pgTAP for database tests
        ^
        |  writes risk scores once an hour
Python risk job (GitHub Actions) <- weather from Open-Meteo
```

## The pages

**Frontend (what runs on the phone)**

| Tool | Page |
| --- | --- |
| Next.js 16 | [nextjs.md](nextjs.md) |
| React 19 | [react.md](react.md) |
| TypeScript and ESLint | [typescript-eslint.md](typescript-eslint.md) |
| Tailwind CSS and fonts | [tailwind-fonts.md](tailwind-fonts.md) |
| next-intl (English, Hindi, Urdu) | [next-intl.md](next-intl.md) |
| MapLibre GL and OpenFreeMap | [maplibre-openfreemap.md](maplibre-openfreemap.md) |
| H3 hexagons | [h3.md](h3.md) |
| PWA and offline (service worker, manifest, IndexedDB) | [pwa-offline.md](pwa-offline.md) |

**Backend (the server and its APIs)**

| Tool | Page |
| --- | --- |
| Our API layer: withApi, problem+json, rate limits | [api-layer.md](api-layer.md) |
| Zod (input checks) | [zod.md](zod.md) |
| Clerk (sign-in) | [clerk.md](clerk.md) |
| Pino (logs) | [pino.md](pino.md) |
| Sharp (photos) | [sharp.md](sharp.md) |
| Web Push (alerts) | [web-push.md](web-push.md) |
| OpenAPI, Swagger UI and Postman | [openapi-swagger-postman.md](openapi-swagger-postman.md) |
| Aadhaar Secure QR (jsQR, BarcodeDetector, RSA) | [aadhaar-secure-qr.md](aadhaar-secure-qr.md) |

**Database**

| Tool | Page |
| --- | --- |
| Supabase (Postgres, Storage, Realtime, Queues, pg_cron, CLI) | [supabase.md](supabase.md) |
| Row Level Security | [postgres-rls.md](postgres-rls.md) |
| PostGIS | [postgis.md](postgis.md) |
| Drizzle ORM and postgres.js | [drizzle-postgresjs.md](drizzle-postgresjs.md) |

**Risk model**

| Tool | Page |
| --- | --- |
| Python risk job (httpx, python-dotenv) | [python-risk-job.md](python-risk-job.md) |
| Open-Meteo (weather data) | [open-meteo.md](open-meteo.md) |

**Testing**

| Tool | Page |
| --- | --- |
| Vitest | [vitest.md](vitest.md) |
| Playwright | [playwright.md](playwright.md) |
| pgTAP | [pgtap.md](pgtap.md) |
| pytest | [pytest.md](pytest.md) |
| autocannon (load test) | [autocannon.md](autocannon.md) |

**Build, ship and run**

| Tool | Page |
| --- | --- |
| Docker | [docker.md](docker.md) |
| GitHub Actions (CI, gitleaks, npm audit) | [github-actions.md](github-actions.md) |
| Azure Container Apps and GHCR | [azure-container-apps.md](azure-container-apps.md) |

## Words you will hear

| Word | Meaning |
| --- | --- |
| API | A web address the app calls to read or change data, e.g. `GET /api/v1/risk` |
| Route | One API address plus a method (GET, POST, PATCH, DELETE) |
| Migration | A SQL file that changes the database, applied once, in order |
| RLS | Row Level Security: the database itself decides which rows you may see or change |
| JWT / token | A signed note from Clerk that says who you are and your role |
| PWA | Progressive Web App: a website you can add to the home screen and use offline |
| CI | Continuous Integration: tests that run on GitHub for every pull request |
| Container | The app packed with everything it needs, so it runs the same everywhere |
| ETag / 304 | "You already have this version", so nothing is downloaded again |
