# OpenAPI, Swagger UI and Postman

**In one line:** OpenAPI is the written description of every API route; Swagger UI shows it as a web page you can try; Postman runs saved requests to test the API.

## What they are

- **OpenAPI 3.1:** a standard JSON format that lists every route, its inputs, its answers and its errors.
- **Swagger UI** (5.34.1): a web page that reads the OpenAPI file and lets you click "Try it out".
- **Postman:** an app for sending API requests. A "collection" is a saved set of requests with tests. **newman** runs a collection from the command line (we use it in CI).

## Why we use them

- Judges and teammates can see and try every route without reading code.
- The OpenAPI document is built from the routes' own zod schemas (`z.toJSONSchema`), so it can't drift from what the API accepts.
- Postman shows the error cases live: 401, 403, 422, 429.

## Where they are in our project

| Path | What it holds |
| --- | --- |
| `src/server/openapi/operations.ts` | One hand-written list of every operation, with examples |
| `src/server/openapi/spec.ts` | Builds the OpenAPI 3.1 document |
| `src/server/openapi/openapi.test.ts` | Checks the list against every `route.ts`: method, path, access and rate limit must match; every example must pass the route's schema |
| `app/api/v1/openapi.json/route.ts` | Serves the document at `/api/v1/openapi.json` |
| `app/api/docs/route.ts` | Swagger UI at `/api/docs` |
| `scripts/ui/copy-swagger-ui.mjs` | Copies Swagger UI from `swagger-ui-dist` into `public/vendor/`, so no CDN is needed |
| `postman/` | The collection, the `local` and `ci` environments, and a README |

## How to use them

- **Swagger:** run the app and open http://localhost:3000/api/docs.
- **Postman:** import `postman/RouteGuard.postman_collection.json` and `postman/local.postman_environment.json`, then follow `postman/README.md` for tokens. Writes need the header `Origin: http://localhost:3000`.
- **CI:** newman runs the two keyless Postman folders against the Docker image on every pull request. The signed-in and rate-limit folders run locally.

Example answers in the document use made-up ids, names and times, and say so.

## Learn more

- https://spec.openapis.org/oas/v3.1.0
- https://swagger.io/tools/swagger-ui/
- https://learning.postman.com/docs/

## Questions you may be asked

**Q: How do you keep the API docs correct?**
A: The request schemas in the document are the same zod schemas the routes use, and a test fails if a route's method, path, access or rate limit doesn't match its entry.

**Q: Why serve Swagger UI from your own server?**
A: So our Content-Security-Policy can stay "scripts from our own site only", with no outside CDN.

**Q: What does the Postman collection test?**
A: Public reads, 401 for signed-out calls, 403 for the wrong role, 422 for bad input like a wrong truck number, and 429 when a rate limit is hit. Every error must be problem+json with a request id.

**Q: Why OpenAPI 3.1 and not 3.0?**
A: 3.1 uses standard JSON Schema, which is exactly what zod 4 produces, so no extra package is needed.
