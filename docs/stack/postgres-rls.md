# Row Level Security (RLS)

**In one line:** the database itself decides which rows each person may see or change, so even a buggy API route can't leak data.

## What it is

Row Level Security is a PostgreSQL feature. You turn it on for a table and write **policies**: rules like "a user may read a shipment only if they own it or are its driver". Every query is filtered by these rules, whoever sends it.

## Why we use it

- **Two locks.** The API checks roles in `withApi()`. The database checks again with RLS. A route that forgets a check still can't read or change rows it shouldn't.
- The rules sit next to the data, so they apply to every way in: our API, Realtime and Storage.

## Where it is in our project

| Path | What it holds |
| --- | --- |
| `supabase/migrations/*_rls_*.sql` | The policies |
| `supabase/migrations/*_app_db_role.sql` | `routeguard_app`, the login our server uses, which can read nothing on its own |
| `src/server/db/index.ts` | `db.rls()`: runs each request as the caller |
| `supabase/tests/rls.test.sql` | The tests that prove the rules work |
| `docs/security.md` | The full security write-up |

## How it works in RouteGuard

1. The server connects as `routeguard_app`, a login with no rights of its own.
2. Each request is **one transaction** that:
   - switches to the role `anon` (signed out) or `authenticated` (signed in),
   - sets the caller's verified Clerk claims (`sub` = user id, `metadata.role`),
   - sets a 5-second statement timeout.
3. The policies read those claims with helper functions:
   - `private.jwt_sub()`: who you are.
   - `private.jwt_role()`: your role, **only if** your `users` row has the same role, is approved by TCU and isn't deleted.
4. Changes that need special care go through SQL functions (e.g. `tcu_review_user`, `admin_set_role`) that check the caller and write an audit row in the same step.

Other roles: the queue worker uses `routeguard_worker`, which can only run job functions. Only the hourly risk job and the seed script use the secret key that skips RLS.

## Examples

- A shipment can be read only by the people on it (whoever created it, its agent and its driver) and by TCU.
- A photo in `report-photos` can only be uploaded into a folder named after your own user id.
- A new account waiting for TCU has no role in the database, even if a token claimed one.

## Questions you may be asked

**Q: If the API already checks roles, why RLS too?**
A: Defence in depth. If someone writes a new route and forgets the check, the database still refuses. `docs/security.md` lists this as the "route that forgets a check" threat.

**Q: Can a user fake their role in the token?**
A: The token is signed by Clerk, so it can't be edited. And `jwt_role()` also checks the `users` table, so a role counts only if TCU approved it.

**Q: How do you know every table has RLS?**
A: A pgTAP test fails if any table has RLS turned off.

**Q: What is the difference between `anon` and `authenticated`?**
A: `anon` is a signed-out visitor: public data only. `authenticated` is a signed-in user; what they can see then depends on their id and role.

**Q: Doesn't RLS make queries slow?**
A: The policies are simple comparisons on indexed columns. The public risk data is also cached, so most requests never reach the database.
