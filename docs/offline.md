# Offline (BUILD_PROMPT section 13)

NH-44 loses signal in the Ramban–Banihal stretch and in the tunnels. The app
keeps working there with what the phone saved last, and says how old it is.

The service worker is `public/sw.js`, written by hand with the same policy at
its top. Its rules are tested in `src/ui/offline/sw-policy.test.ts`. It only
runs in production builds (`npm run build && npm start`); `next dev` removes
any worker left from a production run.

## What is saved, and how

| What | Strategy | Notes |
|---|---|---|
| `/_next/static/*`, icons, manifest, `/offline.html` | Cache first | File names carry a content hash, so a copy never goes stale |
| Public pages: `/`, `/advisor`, `/strip`, `/status`, `/privacy` | Network first, then the last good copy | Saved on install, with the build files they load, so they open offline even if never visited. The copy is in the language you last saw the page in |
| `/api/v1/risk`, `/risk/summary`, `/zones`, `/official-updates`, `/incidents`, `/road-status`, `/reports` (GET), `/model` | Network first, then the last good copy | Only a 200 without `private` or `no-store`. A copy from the cache carries `X-RG-Cached-At`, and the strip under the header says "Showing data saved at 14:07 (2 hours old)" |
| Map tiles from tiles.openfreemap.org | Cache first | Only tiles that touch the corridor box (lat 32.6–34.2, lng 74.7–75.4), at most 300, oldest out first. Style, sprites and fonts: network first |
| Everything else | Network only | Every page that needs a sign-in (`/board`, `/report/new`, `/me`, `/admin`, `/sign-in`), every signed-in API (`/me`, `/shipments`, `/agents`, `/admin`, `/verify`, `/advice`), every write. With no signal a page here shows `/offline.html` |

Next.js marks streamed pages `private, no-store`. That header is Next's
default, not a statement about privacy, so the five public pages are saved
anyway; they show the same thing to everyone. API answers follow their own
`Cache-Control`.

## Your own data

Your board (your lots, your trucks) is saved in IndexedDB (database
`routeguard`, store `private`) under your user id, and only read back for the
same id. With no signal the board shows that copy and when it was saved.
The service worker never stores it.

Signing out (or deleting your account) on `/me` wipes the IndexedDB stores
and every `rg-*` cache before signing out, so nothing stays for the next
person on the same phone (`clearOfflineData` in
`src/ui/offline/private-store.ts`).

## Reports written with no signal

1. The report screen shrinks the photo to about 300 KB (JPEG, longest side
   at most 1600 px; this also drops the photo's EXIF data) and sends it with
   its `Idempotency-Key`.
2. If the request can't leave the phone, the report goes to the outbox
   (IndexedDB store `outbox`) with the same key, and the screen says it will
   be sent by itself.
3. The outbox is sent when the app opens, when the phone comes back online,
   and every minute while reports wait. The strip under the header says
   "2 reports waiting to send" with a "Send now" button.
4. A report is only sent as the person who wrote it (checked with
   `GET /api/v1/me`). Signed out, it waits and the strip offers sign-in.
5. The key makes a resend harmless: the server answers "repeat".
6. A report older than its hazard's expiry (`config/report-rules.json`) is
   dropped instead of sent, since it would leave the map at once. A report the
   server refuses for good (4xx other than 401 and 429) is dropped too. The
   strip says how many were dropped.

Known limit: the server dates a report when it arrives, not when it was
written, so a report sent an hour late also stays on the map an hour longer.

## Updates

Each deploy registers `/sw.js?v=<DEPLOYMENT_VERSION>`, so the browser
installs a new worker with new cache names. It waits until you press
"Reload" in "New version ready. Reload"; we never call `skipWaiting()` on
our own. The old caches are removed when the new worker takes over.
`/sw.js` is served with `Cache-Control: no-cache` so the browser always
checks for a new copy.

## Advice offline

The advisor asks the server first. With no signal it runs the same
`decide()` on the phone with the scores and road status the worker saved,
and says the answer came from the phone. `advice.routes.test.ts` checks that
both give the same answer.

## Trying it

1. `npm run build && npm start`, open http://localhost:3000, wait a few
   seconds, reload once (the worker now controls the page).
2. In Chrome DevTools → Network, choose "Offline".
3. Reload `/`, `/strip`, `/advisor`: they open with the saved scores. `/board`
   shows the offline page.

The built-in browser of the Claude desktop app can't register service
workers; use Chrome or Playwright's Chromium.
