# Our API layer: withApi, problem+json, rate limits

**In one line:** one wrapper, `withApi()`, gives every API route the same sign-in check, error format, logging and limits, so each route only does its own job.

## What it is

Our own small code in `src/server/http/`, not a library. Every route under `app/api/v1/` is wrapped:

```ts
export const POST = withApi(
  { access: ["grower", "trader", "agent"], rateLimit: "report" },
  async ({ req, caller }) => { /* the route's own work */ },
);
```

## Why we built it

- A route can't "forget" the sign-in check, the error format or the request id. `app/api/routes.test.ts` fails the build if any exported handler isn't `withApi(...)` or `notAllowed(...)`.
- Every error looks the same to the app, Postman and the judges.

## Where it is in our project

| Path | What it does |
| --- | --- |
| `src/server/http/with-api.ts` | The wrapper: request id, logging, access check, Origin check, rate limit, errors |
| `src/server/http/errors.ts` | `NotFoundError`, `ForbiddenError`, `ConflictError`, `ValidationError` ... |
| `src/server/http/problem.ts` | Turns any error into problem+json |
| `src/server/http/body.ts` | `readJson(req, schema)` and `readQuery(req, schema)` |
| `src/server/http/rate-limit.ts` | The limits, counted in Postgres |
| `src/server/http/caller.ts` | Reads the Clerk user id and role from the session |
| `src/server/http/README.md` | How to write a route, with a full example |

## How it works in RouteGuard

**1. Access.** `access: "public"`, `"signed-in"` or a list of roles like `["admin"]`. Signed out gets **401**, wrong role gets **403**.

**2. CSRF check.** Writes (POST, PUT, PATCH, DELETE) need an `Origin` header that matches our host, or they get 403. Browsers send it; in Postman you add it by hand.

**3. Errors as problem+json** (RFC 9457, `Content-Type: application/problem+json`):

```json
{
  "type": "about:blank",
  "title": "Invalid input",
  "status": 422,
  "detail": "Some fields are not valid.",
  "instance": "/api/v1/shipments",
  "request_id": "…",
  "errors": [{ "path": "truck", "message": "Not a truck number. Use a format like JK05G7712 or 22BH1234AA." }]
}
```

Status codes we use: 400 bad JSON or bad query, 401, 403, 404, 405, 409 conflict, 413 too big, 415 wrong content type, 422 bad body fields, 429 too many requests, 503 a service is down.

**4. Request id.** Every answer has an `X-Request-Id` header, also in the log line and in the error body, so one id finds the matching log.

**5. Rate limits**, counted in Postgres (`private.rate_limit_hit()`), so they hold across several servers. Over the limit gives 429 with `Retry-After`.

| Name | Limit |
| --- | --- |
| advice | 60 a minute per IP |
| report | 10 an hour per user |
| confirmation | 30 an hour per user |
| role | 5 an hour per user |
| verification | 5 an hour per user |
| push | 20 an hour per user |
| review (TCU approvals) | 120 an hour per user |

These limits are our own choices, not figures from a source.

**6. Caching for public reads.** `/api/v1/risk` sends an `ETag` (the latest run time). A phone that sends it back gets `304 Not Modified` with no body. See `docs/scaling.md`.

## Questions you may be asked

**Q: What happens if a developer forgets to check the role in a new route?**
A: Two locks. A test fails if the route isn't wrapped in `withApi()`. And the database's Row Level Security checks again, so even a wrong route can't read rows the caller may not see.

**Q: Why problem+json?**
A: It's a standard (RFC 9457), so any client knows where to find the status, a readable message and the field errors.

**Q: What is the difference between 400 and 422?**
A: 400: we couldn't read the request (broken JSON or a bad query string). 422: we read it, but a field is wrong, like a bad truck number.

**Q: Why store rate limits in the database and not in memory?**
A: On Azure the app can run as up to 3 copies. A memory counter would be per copy, so someone could get 3 times the limit. Postgres is shared.

**Q: What is CSRF and how do you stop it?**
A: Another website tricking your browser into sending a request to us with your cookies. We refuse any write whose `Origin` isn't our own site.
