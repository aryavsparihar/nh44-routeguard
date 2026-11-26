# Riya: UI, languages, offline mode and frontend tests

## What I work on

I look after the app screens and the parts that connect them: the app layout in `src/ui/` and `app/[locale]/`, the English/Hindi/Urdu language setup, sign-in and onboarding, offline behaviour, the shipment board, and frontend tests.

Some important places in the code are:

- Screens and layout: `src/ui/` and `app/[locale]/`
- Translations and language setup: `messages/*.json`, `src/i18n/`, and `scripts/ci/check-i18n.mjs`
- Sign-in and verification: `src/ui/auth/`
- Offline support: `public/sw.js`, `src/ui/offline/`, and `docs/offline.md`
- Shipment board: `src/ui/board/`
- Browser tests: `e2e/`

## One request I can explain

Imagine a driver is in an area with no network and submits a report.

1. The app cannot send the report, so it saves the report and photo on the phone in IndexedDB.
2. It gives the report an idempotency key. This is a unique key that helps the server recognise a retry as the same report instead of creating a duplicate.
3. The screen tells the driver that the report is saved on the phone and waiting to send.
4. When the phone is online again, the app sends the saved report to `POST /api/v1/reports` using the same key.
5. After it is sent, the app shows that the waiting report was sent.

The code for saving and sending is in `src/ui/offline/outbox.ts`. The offline queue is tested in `e2e/signed-in.spec.ts`.

## One test and what it checks

The test named “a report written with no signal waits on the phone and sends itself” is in `e2e/signed-in.spec.ts`.

It signs in as the demo driver, turns the network off, submits a report, checks that the app says it is queued, then turns the network back on and checks that the report is sent.

There is also a service-worker test in `src/ui/offline/sw-policy.test.ts`. It checks that the service worker does not cache signed-in pages or responses from `/api/v1/me`. This matters because private account information should not be stored in a shared browser cache.

## One decision we made

We keep the selected language in a cookie instead of putting it in the page URL. Urdu also sets the page direction to right-to-left, so the layout reads correctly.

We did not use language prefixes such as `/ur/...`. They caused problems with cached paths and sign-in redirects. We also kept our own service worker instead of using Serwist, because we wanted direct control over which pages and responses must never be cached.

## One limitation

Some Hindi and Urdu safety messages are machine-drafted and still need review by fluent speakers. This is important because a translation mistake in a road-safety message could confuse a driver.

The review status is tracked in `messages/REVIEW.md`. The next step is to have fluent Hindi and Urdu readers check those messages and record their review there.

## The Aadhaar card and verification screen

On the account page (`/me`), the Aadhaar check asks for consent before opening the camera. The screen explains what information is read and kept, and tells the driver not to type their Aadhaar number.

The app reads the QR using the browser's `BarcodeDetector`, or `jsQR` if that feature is not available. It processes the camera frame, clears the temporary image, and sends only the extracted digits for checking. The app's Aadhaar text is stored under `me.aadhaar.*` in the translation files.

This check is optional. Drivers can also be verified through an agent's vouch. The QR demo uses a test key and a sample QR, not a real Aadhaar card. The related translation strings are still marked as needing review in `messages/REVIEW.md`.

## Questions I am preparing to explain in the demo

- Why does Urdu use right-to-left layout?
- What happens to a report when the phone has no internet?
- What does the idempotency key prevent?
- Why do we avoid caching signed-in account responses?
- Why is Aadhaar optional, and what does the demo QR actually prove?

Before presenting, I should be able to explain each answer without reading the file. If I cannot explain one clearly, I should mark it for practice in my rehearsal notes and ask a teammate to check my explanation.
