# Zod 4 (input checks)

**In one line:** zod checks every piece of data that comes into the API and refuses anything that isn't exactly what we expect.

## What it is

Zod is a TypeScript library for describing the shape of data, a "schema", and checking real data against it at runtime. Version 4.6.7.

```ts
const newShipment = z.object({
  truck: truckNumber,
  tonnes: z.number().min(0.1).max(40),
}).strict(); // an unknown field → 422
```

## Why we use it

- TypeScript types disappear when the code runs, so they can't check what a phone sends. Zod can.
- One schema gives both the runtime check and the TypeScript type.
- Zod 4 can turn a schema into JSON Schema (`z.toJSONSchema`), which we use for the OpenAPI document. The docs can't drift from what the API really accepts.

## Where it is in our project

| Path | What it holds |
| --- | --- |
| `src/server/*/*.schemas.ts` | Each feature's schemas, e.g. `src/server/users/users.schemas.ts` |
| `src/server/schemas/common.ts` | Shared pieces: `cleanText(max)`, `truckNumber`, `corridorLat`, `corridorLng`, `pageQuery` |
| `src/server/http/body.ts` | `readJson(req, schema)` and `readQuery(req, schema)` use them |

## Our rules

- Every object ends with `.strict()`: unknown fields are refused, not ignored.
- Every text has a maximum length (`cleanText(60)` for a name, for example).
- Numbers from the URL use `z.coerce.number()`.
- Never put user input into Supabase `.or()`, `.filter()` or `.textSearch()` strings, even after zod.

## Examples from our code

- **Truck number:** `"jk 05 g 7712"` becomes `"JK05G7712"`. It must match a state format (`JK05G7712`) or the Bharat series (`22BH1234AA`).
- **Location:** latitude 32.6 to 34.2, longitude 74.7 to 75.4: the NH-44 corridor box. A point in Delhi is refused.
- **TCU review:** turning an account down without a reason is refused (a `.refine()` rule).

## Learn more

- https://zod.dev

## Questions you may be asked

**Q: Why `.strict()`?**
A: Without it, extra fields are silently dropped. With it, a client sending `role: "admin"` in a profile update gets a clear 422 instead of us guessing.

**Q: What does the user see when a field is wrong?**
A: A 422 problem+json with an `errors` list naming each field and what is wrong, which the form shows next to the field.

**Q: Isn't TypeScript enough?**
A: No. TypeScript only checks our own code while we build it. Data from a phone or Postman could be anything, so zod checks it while the app runs.

**Q: How do you validate a truck number?**
A: Remove spaces and dashes, upper-case it, then match the state pattern or the Bharat-series pattern. Max 20 characters before cleaning.
