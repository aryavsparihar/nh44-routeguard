# Riya: UI/UX, languages, offline, frontend tests (WP-D)

**What I own:** the app shell and screens (`src/ui/`, `app/[locale]/`), English/Hindi/Urdu (`messages/*.json`, `src/i18n/`, `scripts/ci/check-i18n.mjs`, `messages/REVIEW.md`), sign-in and onboarding (`src/ui/auth/`), offline (`public/sw.js`, `src/ui/offline/`, `docs/offline.md`), the agent board (`src/ui/board/`) and the Playwright tests (`e2e/`).

**A request I can trace:** a driver with no signal taps "Send report" on `/report/new` → the fetch fails → the report and its photo go into the IndexedDB outbox with an idempotency key (`src/ui/offline/outbox.ts`) → the screen says it is saved on the phone → when the browser is back online, `OfflineStatus` sends it to `POST /api/v1/reports` with the same key, so a retry never posts twice → "1 waiting report sent".

**A test and what it proves:** `e2e/signed-in.spec.ts`, "a report written with no signal waits on the phone and sends itself": it signs in as the demo driver, goes offline, sends, sees the queued message, goes online and sees it sent. `src/ui/offline/sw-policy.test.ts` checks the service worker never caches signed-in or `/api/v1/me` responses.

**A decision and what we rejected:** the language lives in a cookie, not the URL (`localePrefix: "never"`), and Urdu sets `<html dir="rtl">`. Rejected: `/ur/...` URLs, which break the service worker's cached paths and Clerk redirects. We kept the hand-written service worker instead of Serwist so we control exactly what is never cached.

**A limitation and the fix:** the Hindi and Urdu safety text is machine-drafted and not yet reviewed (`messages/REVIEW.md`). Fix: a fluent reader of each language reviews the safety strings and signs the review table with name and date.
