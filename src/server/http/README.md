# Writing an API route with `withApi()`

Every route under `app/api/v1/` goes through `withApi()`. It gives you request ids, logging, the login and role check, the Origin (CSRF) check and problem+json errors, so your route only does its own job.

## A full example

```ts
// app/api/v1/shipments/route.ts
import { z } from "zod";
import { readJson } from "@/src/server/http/body";
import { ConflictError } from "@/src/server/http/errors";
import { created } from "@/src/server/http/responses";
import { notAllowed, withApi } from "@/src/server/http/with-api";
import { truckNumber } from "@/src/server/schemas/common";

const newShipment = z
  .object({
    truck: truckNumber,
    tonnes: z.number().min(0.1).max(40),
  })
  .strict(); // unknown fields → 422

export const POST = withApi(
  { access: ["grower", "trader", "agent"] }, // others get 403, signed out gets 401
  async ({ req, caller }) => {
    const input = await readJson(req, newShipment); // 415 / 413 / 400 / 422
    // ...call your service here...
    if (alreadyActive) throw new ConflictError("This truck already has an active shipment.");
    return created(shipment, `/api/v1/shipments/${shipment.id}`); // 201 + Location
  },
);

const notSupported = notAllowed(["POST"]);
export { notSupported as GET, notSupported as PUT, notSupported as PATCH, notSupported as DELETE };
```

## What to use

| You want | Use |
|---|---|
| Who may call it | `access: "public"`, `"signed-in"`, or a role list like `["admin"]` |
| Read a JSON body | `readJson(req, schema)` |
| Read `?zone=3&horizon=24` | `readQuery(req, schema)`; use `z.coerce.number()` for numbers |
| Return one item / a list | `ok(data)` / `list(rows, { count, next_cursor })` |
| Return a new item | `created(data, location)` |
| Return nothing | `noContent()` |
| Fail on purpose | `throw new NotFoundError()`, `ForbiddenError`, `ConflictError`, ... (see `errors.ts`) |
| Dynamic segment like `[id]` | `withApi<{ id: string }>(..., async ({ params }) => ...)` |
| Methods you don't support | `notAllowed([...])`, as above, so clients get a JSON 405 |
| Log something | `log.info({ zone }, "message")`. Never log bodies, tokens, phone numbers or query strings |
| The caller in a non-public route | `requireCaller(caller)` gives a `Caller` instead of `Caller \| null` |
| Talk to the database | `const db = await getDb()` then `db.rls((tx) => tx.select()…)` (`src/server/db`): one transaction as the caller's role and claims, so RLS applies; 503 if `DATABASE_URL` isn't set. `sql` templates only, never `sql.raw()` |
| Record a privileged action | `await writeAudit(db, { action, targetType, targetId, reason, requestId })` (`src/server/audit.ts`) |
| Is the data stale? | `dataAgeMinutes(runAt)` and `isStale(age)` from `src/shared/freshness.ts` (over 90 min, or no run). `GET /api/v1/health/ready` reports the same |

Shared zod pieces live in `src/server/schemas/common.ts`: `cleanText(max)`, `truckNumber`, `corridorLat`, `corridorLng`, `pageQuery`. Always end objects with `.strict()`.

## Rules

- Don't catch errors just to return a response yourself. Throw an `ApiError` and let `withApi()` format it.
- Never put user input into Supabase `.or()`, `.filter()` or `.textSearch()` strings. Use `.eq()`, `.in()`, `.gte()` with values that passed zod.
- Writes (POST, PUT, PATCH, DELETE) need an `Origin` header that matches our host. Browsers send it. In curl or Postman, add `Origin: http://localhost:3000`.
- In tests, mock the caller (see `with-api.test.ts` and `src/server/users/users.routes.test.ts`).
- Every exported handler in a `route.ts` under `app/api` must be `withApi(...)` or `notAllowed(...)`. `app/api/routes.test.ts` fails the build otherwise.
- Admin and police actions need a `reason` in the body and an audit row. Write the audit row in the same database function as the change when you can (like `admin_set_role`); otherwise call `writeAudit()` right after the change.
- Pages: start every protected page with `await requirePageRole([...])` (`src/server/auth/page.ts`). `proxy.ts` only sends signed-out visitors to sign-in; it doesn't check roles.
- Put a `*.test.ts` next to your route and call the exported `GET`/`POST` directly with a `NextRequest`. `npm test` runs them.
