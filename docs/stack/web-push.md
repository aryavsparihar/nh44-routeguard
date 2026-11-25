# Web Push (alerts)

**In one line:** Web Push lets us send an alert to a phone, even when the app is closed, when a report is confirmed or an official update comes in for a zone you follow.

## What it is

Web Push is a browser standard. The browser gives us a "subscription" (an address at its push service, e.g. Google's for Chrome). We sign a message with our **VAPID** key and send it there; the push service delivers it and our service worker shows the alert. We use the `web-push` library, version 4.0.0.

## Why we use it

- Works for every major browser with one small library and no Firebase account.
- Drivers get warned without keeping the app open.

## Where it is in our project

| Path | What it does |
| --- | --- |
| `src/server/push/config.ts` | Reads `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (secret), `VAPID_SUBJECT`. Alerts are off unless all three are set and `FEATURE_PUSH` isn't `false` |
| `src/server/push/notify.ts` | Sends one alert per event to every browser following that zone, in that browser's language |
| `app/api/v1/push/subscriptions/` | Turn alerts on or off for a zone |
| `public/sw.js` | Shows the alert on the phone |

## How it works in RouteGuard

1. You tap "Turn alerts on" and pick your zones. The browser asks permission and gives a subscription, which we save.
2. A report is confirmed, or TCU posts an official update. The same database transaction adds a job to the queue (pgmq).
3. pg_cron wakes the job worker. It sends the alert to every subscription following that zone.
4. Each event is pushed once (`private.push_sent`), even if the job runs twice.

**Unconfirmed reports never alert:** one person's word shouldn't wake a driver at 3 am.

## Learn more

- https://developer.mozilla.org/en-US/docs/Web/API/Push_API
- https://github.com/web-push-libs/web-push

## Questions you may be asked

**Q: Why not alert on every new report?**
A: A single unconfirmed report might be wrong or spam. Only confirmed reports and official updates send alerts.

**Q: What is VAPID?**
A: A key pair that proves to the push service that the alert really comes from us. The public key goes to the browser; the private key stays secret on the server.

**Q: What if the job runs twice?**
A: We record each event we've pushed, so the second run sends nothing.

**Q: Does it work on iPhone?**
A: Safari supports Web Push only for web apps added to the home screen (iOS 16.4 and later).
