# PWA and offline: service worker, manifest, IndexedDB

**In one line:** RouteGuard can be added to the home screen like an app and still shows the last risk data with no signal; reports written offline are sent later.

## What these are

- **PWA (Progressive Web App):** a website that can be installed on the home screen and opened full screen.
- **Web app manifest:** a small JSON file with the app's name, colours and icons. The phone reads it when you "Add to Home screen".
- **Service worker:** a script that sits between the page and the network. It can answer from a saved copy when there is no signal.
- **IndexedDB:** a small database inside the browser, on the phone.

## Why we use them

NH-44 loses signal in the Ramban–Banihal stretch and in the tunnels. A driver must still see the last risk, and a report written there must not be lost.

## Where they are in our project

| Path | What it holds |
| --- | --- |
| `public/manifest.webmanifest` | Name "RouteGuard NH-44", `display: standalone`, theme colour `#005f3f`, icons |
| `public/sw.js` | The service worker, written by hand (no build step), so what you read is what runs |
| `public/offline.html` | Shown when a page was never saved and there's no signal |
| `src/ui/offline/outbox.ts` | Reports waiting to be sent |
| `src/ui/offline/private-store.ts` | Your own board and lots, saved under your user id |
| `src/ui/offline/OfflineStatus.tsx` | "Offline" banner and "New version ready. Reload" |
| `docs/offline.md` | The full policy in words |

## How it works in RouteGuard

What the service worker does with each kind of request:

| Kind | Rule |
| --- | --- |
| `/_next/static/*`, fonts, icons | **Cache first**: the file names carry a content hash, so a copy never goes stale |
| Public pages (`/`, `/advisor`, `/strip`, `/status`, `/privacy`) and public GETs (`/api/v1/risk`, `/risk/summary`, `/zones`, ...) | **Network first, then the last good copy.** The copy carries `X-RG-Cached-At`, so the page can say how old it is |
| Map tiles | Cache first, only tiles in the NH-44 box, with a cap |
| Signed-in pages and APIs, every POST/PATCH/DELETE | **Network only, never stored** |

- **Private data** never goes in the service worker cache. It sits in IndexedDB under your user id, and signing out wipes it.
- **Offline reports** wait in the IndexedDB outbox with their `Idempotency-Key`. They are sent when the app opens or the phone comes back online. If one is sent twice, the server sees the same key and doesn't make a second report.
- **Updates:** a new version installs in the background and waits. Only the "Reload" button switches to it, so the page never changes code halfway through.

## How to install it

- **Android (Chrome):** open the site, menu ⋮, "Add to Home screen" or "Install app".
- **iPhone (Safari):** Share button, "Add to Home Screen".

The service worker only runs on `https://` or `localhost`. On a phone using the laptop's LAN address over plain `http://`, it won't register.

## Learn more

- https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps
- https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
- https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API

## Questions you may be asked

**Q: What happens if a driver opens the app in the tunnel?**
A: The page and the risk data come from the last saved copy (if it was opened before with signal), with a banner saying how old it is. Nothing pretends to be live.

**Q: Can someone else on the same phone see my shipments offline?**
A: Private data is saved under your user id and only read back for that id, and signing out wipes it. The service worker never stores signed-in pages.

**Q: What stops an offline report being sent twice?**
A: Each report carries an `Idempotency-Key` (a UUID). If the server sees the same key again, it answers "repeat" and doesn't create a second report.

**Q: Why write the service worker by hand instead of using a library like Workbox?**
A: It's short, has no build step, and every caching rule is visible in one file. `src/ui/offline/sw-policy.test.ts` tests the rules.

**Q: Why not use `skipWaiting()` so updates happen at once?**
A: It could switch a page to new code while it's open, mid-form. We wait until the user taps Reload.
