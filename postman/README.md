# Postman collection

`RouteGuard.postman_collection.json` has requests and tests for every kind of
answer the API gives. The same API is described in OpenAPI at `/api/docs`
(Swagger UI) and `/api/v1/openapi.json`.

| Folder | Needs | What it checks |
|---|---|---|
| 1 Public | nothing (the database is optional) | Every public read and the advice; 200 with the right shape, or 503 problem+json when there is no database |
| 2 Errors without signing in | nothing | 401 on signed-in endpoints, 401/503 for the queue worker without its secret, 403 for a write without our Origin header, 400, 404, 405, 415 and 422 with problem+json |
| 3 Signed in (local, needs tokens) | the database and two Clerk session tokens | A grower's profile, 403 for a grower posting an official update, 422 for a bad truck number, a driver's board, and 429 after 5 wrong invite codes in an hour |
| 4 Rate limit (local, needs the database) | the database | 429 with `Retry-After` after 60 advice requests in a minute from one address |

Every request also checks that the answer has an `X-Request-Id` header, that
every error has a `request_id`, and that it came within 5 seconds.

Nothing in the collection creates data. The 429 checks use invalid advice
requests and wrong invite codes, which are refused but still counted.

## Run it

CI runs folders 1 and 2 against the app image with no keys
(`.github/workflows/ci.yml`, Docker job).

Locally, with the app running on port 3000 (`npm run build && npm start`):

```bash
npx -y newman@6.2.3 run postman/RouteGuard.postman_collection.json -e postman/local.postman_environment.json --folder "1 Public" --folder "2 Errors without signing in" --folder "4 Rate limit (local, needs the database)"
```

Folder 4 uses up the advice limit for your address for a minute.

In Postman: Import → both JSON files, pick the "RouteGuard local" environment,
and run a folder.

## Tokens for folder 3

Folder 3 skips its requests until `growerToken` and `driverToken` are set.
They are Clerk session tokens of two test users: one who picked "grower" and
one who picked "driver" on `/me`. Use test accounts, not your own.

1. Sign in as the test grower in the browser and open `/me`.
2. In the browser console run `copy(await Clerk.session.getToken())`.
3. Paste it as `growerToken` in the "RouteGuard local" environment (it's
   marked secret, so Postman hides it). Do the same for the driver.
4. Run the folder straight away: a Clerk session token lasts about a minute.

With newman, pass them on the command line instead of saving them in a file:

```bash
npx -y newman@6.2.3 run postman/RouteGuard.postman_collection.json -e postman/local.postman_environment.json --folder "3 Signed in (local, needs tokens)" --env-var growerToken=PASTE --env-var driverToken=PASTE
```

Never commit a token. The environment files in this folder have the token
values empty.
