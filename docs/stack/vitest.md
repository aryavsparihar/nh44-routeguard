# Vitest (unit and API tests)

**In one line:** Vitest runs our fast TypeScript tests: functions, components and every API route, without a browser or a real database.

## What it is

Vitest (version 5.1.0) is a test runner for JavaScript and TypeScript. A test file sits next to the code it tests (`with-api.ts` → `with-api.test.ts`).

```ts
it("422 for unknown fields (.strict())", async () => {
  // call the route with a bad body, expect a 422 problem+json
});
```

## Why we use it

- Fast, and it understands TypeScript with no extra setup.
- API routes are just functions, so tests call `GET`/`POST` directly with a `NextRequest`.
- Built-in coverage reports (`@vitest/coverage-v8`).

## Where it is in our project

| Path | What it holds |
| --- | --- |
| `vitest.config.mts` | Settings: which files are tests, coverage |
| `src/**/*.test.ts(x)`, `app/**/*.test.ts` | The tests |
| `app/api/routes.test.ts` | Fails if any route skips `withApi()` |
| `src/server/openapi/openapi.test.ts` | Checks the API docs match every route |
| `src/ui/risk/xss.test.tsx` | Checks user text can't become HTML |

On 26 Nov 2026: **662 tests in 68 files**, line coverage **42.2%**. We report the number; there's no minimum yet.

## Commands

```bash
npm test                   # run all tests once
npm test -- --coverage     # with a coverage report (CI does this)
npx vitest src/server/http # only one folder
```

## Learn more

- https://vitest.dev/guide/

## Questions you may be asked

**Q: How do you test an API route that needs a signed-in user?**
A: We mock the caller (user id and role) and call the route function directly. See `src/server/users/users.routes.test.ts`.

**Q: Do these tests use the real database?**
A: No, they mock it, so they're fast and can run in CI with no keys. The real database rules are tested separately with pgTAP.

**Q: Why is coverage only 42%?**
A: Coverage counts every line, including screens that are tested end to end by Playwright instead. We focused unit tests on the server: errors, access, schemas and rules.

**Q: What is a mock?**
A: A fake stand-in for something slow or external (Clerk, the database), so a test checks only our own code.
