# HTTP status codes in RouteGuard

**In one line:** every answer from our API starts with a three-digit number that says what happened: 2xx it worked, 3xx you already have it, 4xx the request has a problem, 5xx the problem is on our side.

## What a status code is

Each time the app (or Postman) calls a URL like `GET /api/v1/risk`, the server answers with a **status code** and usually a body. The first digit gives the group:

| Group | Meaning | Whose problem? |
| --- | --- | --- |
| **2xx** | Success | Nobody's |
| **3xx** | Look elsewhere, or "you already have it" | Nobody's |
| **4xx** | The request is wrong or not allowed | The caller's: fix the request |
| **5xx** | The server couldn't do it | Ours: try again later |

## Where it is in our project

| Path | What it holds |
| --- | --- |
| `src/server/http/responses.ts` | The success helpers: `ok()` 200, `created()` 201, `noContent()` 204 |
| `src/server/http/errors.ts` | One error class per 4xx/5xx code |
| `src/server/http/problem.ts` | Turns any error into a problem+json body |
| `src/server/http/with-api.ts` | Catches every error in a route and sends the right code |
| `src/server/http/db-errors.ts` | Turns "database down" into 503 |
| `src/server/openapi/operations.ts` | Lists the codes each route can send (see `/api/docs`) |

## Success codes

| Code | Name | When we send it | Example |
| --- | --- | --- | --- |
| **200** | OK | A read worked, or a change worked and we send the result back | `GET /api/v1/risk`; `POST /api/v1/reports` when the same report is sent again (answer "repeat") |
| **201** | Created | Something new was made. A `Location` header points to it | A new report, shipment, official update, agent invite, onboarding, alert subscription |
| **204** | No Content | It worked and there is nothing to send back | `DELETE /api/v1/me` (delete my account), turning alerts off |
| **304** | Not Modified | Your copy is already the newest, so no body is sent | `GET /api/v1/risk`, `/risk/summary`, `/risk/hexes` when you send `If-None-Match` with the ETag you have |

**How 304 works:** the risk answer carries an `ETag`, which is the time of the latest risk run. The phone sends it back in `If-None-Match`. If no new run has happened since, we answer 304 with no body, which saves data on a slow network.

## Error codes (4xx: fix the request)

| Code | Name | What it means here | Real examples from our code |
| --- | --- | --- | --- |
| **400** | Bad Request | We can't read the request: broken JSON, a bad query string, an unreadable form, or a missing required header | "The body is not valid JSON."; a report sent with no `Idempotency-Key`; `?horizon=7` on `/api/v1/risk` |
| **401** | Unauthorized (we say "Not signed in") | Nobody is signed in, or the job worker's secret is wrong | Opening `/api/v1/me` signed out: "Sign in to use this." |
| **403** | Forbidden | Signed in, but not allowed: wrong role, someone else's row, or a write from another website (wrong `Origin`) | A grower posting an official update: "Your role can't do this."; "Origin doesn't match this site."; "Only the assigned driver sends a location." |
| **404** | Not Found | That id doesn't exist (or isn't yours to see) | "No shipment with this id on your board."; "No report with this id." |
| **405** | Method Not Allowed | The URL exists but not with that method. The `Allow` header lists the right ones | `PUT /api/v1/risk` |
| **409** | Conflict | The request is fine, but it clashes with the current state | "This truck already has an active shipment."; "This account is already approved."; "This invite code was already used or has expired." |
| **413** | Payload Too Large | The body is too big | JSON over 32 KB; a photo over 5 MB |
| **415** | Unsupported Media Type | The wrong `Content-Type` | Sending a form to a route that expects `application/json` |
| **422** | Unprocessable Content (we say "Invalid input") | We read it, but a field breaks the rules (zod). The `errors` list names each field | A bad truck number; a location outside the NH-44 corridor; an unknown extra field (`.strict()`); a file that isn't a JPEG, PNG or WebP; turning an account down without a reason |
| **429** | Too Many Requests | A rate limit was hit. `Retry-After` says how many seconds to wait | More than 10 reports in an hour; more than 5 Aadhaar checks in an hour |

**400 or 422?** 400: we couldn't even read it (broken JSON, bad query string). 422: we read it fine, but a value is wrong. A bad *query string* is always 400 and a bad *body* is 422.

**401 or 403?** 401: we don't know who you are, so sign in. 403: we know who you are, and you aren't allowed.

**404 or 403 for someone else's data?** We usually say 404 ("not on your board"), so a stranger can't even learn that the id exists.

## Server codes (5xx: our side)

| Code | Name | When we send it | Examples |
| --- | --- | --- | --- |
| **500** | Internal Server Error | A bug: something failed that we didn't expect. The body never shows internal details | "Something went wrong on our side. Quote the request id if you report it." |
| **503** | Service Unavailable | Something we depend on is down or not set up. Trying again later can work | The database is unreachable or over our 5 s timeout; Clerk is unreachable; photo storage failed; "Approved, but Clerk didn't update. Send the same approval again."; `GET /api/v1/health/ready` when the database can't be reached |

Old risk data is **not** an error: `/api/v1/health/ready` still answers 200 with `stale: true`, and the app shows the "data is old" banner.

## What every error body looks like (problem+json)

Every 4xx and 5xx comes as `Content-Type: application/problem+json` (the RFC 9457 standard):

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

- `status` is the same number as the HTTP code.
- `detail` is a short, safe sentence for the user.
- `request_id` matches the `X-Request-Id` header and the server log line, so one id finds what went wrong.
- `errors` only appears on 400 and 422 and lists each bad field.

## Pages (not the API)

- A signed-out visitor to `/board`, `/report/new`, `/me` or `/admin/...` is **redirected** to `/sign-in`.
- A signed-in user with the wrong role (for example a driver opening `/admin/approvals`) gets the **404 "not found"** page, so the page doesn't even admit it exists.
- An unknown address shows the same not-found page.

## How to see them yourself

- **Swagger:** open http://localhost:3000/api/docs. Every route lists the codes it can send.
- **Postman:** the collection in `postman/` has folders for 401s, 403s, 422s and 429s.
- **Terminal:** `curl -i http://localhost:3000/api/v1/risk` shows the status line and headers.

## Questions you may be asked

**Q: Why not send 200 for everything with an "error" field in the body?**
A: Then every client must read the body to know if it worked. The real status code lets browsers, the service worker, Postman and monitoring tools see a failure at once.

**Q: What's the difference between 401 and 403?**
A: 401: you aren't signed in. 403: you are signed in, but your role (or the `Origin`) isn't allowed to do this.

**Q: When do you send 409?**
A: When the request is valid but clashes with what already exists, like a second active shipment for the same truck, or approving an account that's already approved.

**Q: What does the app do with a 429?**
A: The screen shows a "too many tries, wait a little" message in the user's language. The answer also carries `Retry-After` (seconds to wait) for other clients like Postman. The limits are counted in Postgres, so they hold across every server copy.

**Q: Why is a sent-again report 200 and not 201?**
A: The phone may resend a report after losing signal. The same `Idempotency-Key` means it's the same report, so nothing new is made: 200 with "repeat", not 201.

**Q: Why 503 and not 500 when the database is down?**
A: 503 tells the client "not your fault, try again soon". 500 means a bug in our code. Keeping them apart shows in the logs which is which.

**Q: Does a 500 leak anything?**
A: No. The body only has a generic sentence and the request id. The details go to our log, never to the client.

**Q: Why do you answer 404 for someone else's shipment?**
A: A 403 would tell a stranger "this shipment exists, you just can't see it". A 404 tells them nothing.
