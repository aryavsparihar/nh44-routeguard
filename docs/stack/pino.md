# Pino (logs)

**In one line:** pino writes one JSON line per event to the server's output, so we can search what happened without logging anything private.

## What it is

Pino is a fast logging library for Node.js. Each log is one line of JSON, e.g. `{"level":30,"request_id":"…","route":"/api/v1/risk","status":200,"ms":3}`. Version 10.4.0.

## Why we use it

- JSON lines are easy to search. On Azure Container Apps, everything the app prints goes to Log Analytics.
- It's fast, so logging doesn't slow requests.
- It can **redact** fields: hide them even if someone logs them by mistake.

## Where it is in our project

| Path | What it does |
| --- | --- |
| `src/server/http/logger.ts` | Creates the logger and the redact list |
| `src/server/http/with-api.ts` | Logs one line per request with fields it picks by hand |

## Our rules

- Never log request bodies, tokens, cookies, phone numbers, photos or query strings.
- `withApi()` only logs fields it chooses (method, route, status, request id and the like).
- As a second lock, pino replaces `authorization`, `cookie`, `token` and `phone` (at any level) with `[Redacted]`.
- The Aadhaar check never logs the QR or anything in it.

## Learn more

- https://getpino.io

## Questions you may be asked

**Q: How do you find out why a request failed?**
A: The error body and the `X-Request-Id` header carry a request id. Search the logs for that id to find the matching line.

**Q: Could a password or token end up in the logs?**
A: We don't log bodies or headers at all, and pino's redact list hides `authorization`, `cookie`, `token` and `phone` if anyone logs a whole object by mistake.

**Q: Why not `console.log`?**
A: `console.log` gives plain text with no levels and no redaction. Pino gives searchable JSON with both.
