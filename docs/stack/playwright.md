# Playwright (end-to-end tests)

**In one line:** Playwright opens the real app in a real browser, sized like a phone, and clicks through it like a user.

## What it is

Playwright (`@playwright/test` 1.65) is a tool that controls a browser from a test script: open a page, tap a button, type, check what appears.

## Why we use it

- Unit tests can't show that the whole thing works together: page, API, sign-in and database.
- It can pretend to be a phone (screen size, touch), which is how drivers use RouteGuard.

## Where it is in our project

| Path | What it holds |
| --- | --- |
| `playwright.config.ts` | Three projects: `pixel-5`, `phone-360` and `signed-in` |
| `e2e/mobile.spec.ts` | Public screens on phone sizes: no sideways scroll, the "not an official police service" notice on every screen, Urdu right-to-left, the not-found page; with keys also the advisor and the 48-hour strip |
| `e2e/signed-in.spec.ts` | Signed-in flows with Clerk test accounts, e.g. "a new driver waits for TCU, TCU approves, and the driver's role works" |
| `e2e/global-setup.ts` | Gets a Clerk testing token for signed-in runs (`E2E_DB=1`) |

On 26 Nov 2026: **12 tests per phone size**, plus **7 signed-in tests**.

## How it works in RouteGuard

- **In CI**, the mobile tests run against the Docker image (no keys), in Chromium.
- **Signed-in tests** run locally with Clerk test emails (`+clerk_test`, code `424242`) via `@clerk/testing`, after `npm run db:seed-demo`.

## Commands

```bash
npx playwright install chromium     # once
npm run e2e                         # all tests
npx playwright test --project=signed-in
```

## Learn more

- https://playwright.dev/docs/intro

## Questions you may be asked

**Q: Why test on phone sizes?**
A: Drivers and growers use phones. `phone-360` is a small 360 px-wide screen, where layouts break first.

**Q: How do you sign in during a test without a real email?**
A: Clerk test emails (`+clerk_test`) accept the fixed code `424242`, and `@clerk/testing` gets past bot protection in tests.

**Q: Why don't the signed-in tests run in CI?**
A: CI has no Clerk or database keys, by design, so no secret is ever exposed in a pull request.

**Q: What's the difference from Vitest?**
A: Vitest tests small pieces quickly. Playwright tests the whole app in a browser, which is slower but closer to a real user.
