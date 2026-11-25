# pgTAP (database tests)

**In one line:** pgTAP tests the database's own security rules by acting as different users and checking what each one can and can't do.

## What it is

pgTAP is a testing extension for PostgreSQL. Tests are SQL:

```sql
select is(
  (select count(*) from public.shipments),
  0::bigint,
  'a stranger sees no shipments'
);
```

## Why we use it

- Row Level Security is our second lock, so it needs its own proof.
- The tests run inside the database, against the real policies and functions.

## Where it is in our project

| Path | What it holds |
| --- | --- |
| `supabase/migrations/20261124160000_enable_pgtap.sql` | Turns pgTAP on |
| `supabase/tests/rls.test.sql` | All the tests: **243** on 26 Nov 2026 |
| `scripts/db/rls-test.sh` | Runs them on the hosted project without Docker |

## How it works in RouteGuard

- The file starts a transaction, inserts test users and rows, then **switches to each role** (signed out, grower, driver, TCU ...) with that user's claims and checks what they can read and change.
- It ends with `ROLLBACK`, so nothing it inserts stays in the database.
- Examples of what it checks: every table has RLS on; a pending account's token role counts for nothing; only TCU can approve accounts; a rejection needs a reason; police and admin can't be granted through the app.
- `RLS_TEST_FILE` runs another file the same way, for a dry run of a new migration plus the tests, all rolled back.

## Commands

```bash
npm run db:test    # asks before running on the hosted project
```

## Learn more

- https://pgtap.org/documentation.html

## Questions you may be asked

**Q: Doesn't testing on the real database change real data?**
A: No. Everything runs in one transaction that ends in `ROLLBACK`, so nothing is kept.

**Q: Why not only test through the API?**
A: The point of RLS is to protect data even when the API is wrong. So we test the database directly, as each kind of user.

**Q: What does TAP mean?**
A: Test Anything Protocol: a simple text format, one `ok` or `not ok` line per test.
