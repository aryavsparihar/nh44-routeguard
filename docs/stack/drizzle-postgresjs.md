# Drizzle ORM and postgres.js

**In one line:** postgres.js is the cable from our server to the database; Drizzle lets us write queries in TypeScript with checked column names.

## What they are

- **postgres.js** (3.4.9): a Node.js client that connects to PostgreSQL and sends SQL.
- **Drizzle ORM** (0.45.4): a light layer on top that writes queries as TypeScript, e.g. `tx.select().from(zones)`, and knows every table's columns and types.

## Why we use them

- Type-checked queries: a wrong column name is a compile error.
- Every value goes in as a **bound parameter**, never pasted into the SQL text, which stops SQL injection.
- Drizzle is thin. We still write real SQL functions in the database for the important rules.

## Where they are in our project

| Path | What it holds |
| --- | --- |
| `src/server/db/client.ts` | The postgres.js connection |
| `src/server/db/index.ts` | `getDb()` and `db.rls()`: every query runs as the caller (see [postgres-rls.md](postgres-rls.md)) |
| `src/server/db/schema.ts` | The Drizzle tables, generated from the database (`npm run db:schema`) |
| `src/server/db/schema.typecheck.ts` | Fails the typecheck if the schema and the database types disagree |
| `src/server/*/*.repository.ts` | The queries for each feature |
| `scripts/ci/check-no-sql-raw.sh` | CI fails if `sql.raw()` is used outside `src/server/db` |

## How it works in RouteGuard

```ts
const db = await getDb();
const rows = await db.rls((tx) => tx.select().from(zones));
```

- Connection settings: `prepare: false` (Supabase's transaction pooler doesn't support prepared statements), at most 5 connections per server copy, 5-second connect timeout.
- If `DATABASE_URL` isn't set, routes answer 503 instead of crashing.
- We use `sql` templates for raw SQL (they still bind values), never `sql.raw()`.

## Commands

```bash
npm run db:schema      # regenerate the Drizzle schema after a migration
npm run db:orm-check   # check the real app login can only do what RLS allows
```

## Learn more

- https://orm.drizzle.team/docs/overview
- https://github.com/porsager/postgres

## Questions you may be asked

**Q: What is an ORM?**
A: An Object-Relational Mapper: it lets you write database queries in your programming language instead of SQL strings.

**Q: Why Drizzle and not Prisma?**
A: Drizzle is small, has no separate engine to run, and lets us wrap every query in our own transaction that sets the caller's role for RLS.

**Q: How do you prevent SQL injection?**
A: Values always travel as bound parameters, separate from the SQL text. CI bans `sql.raw()` outside the database folder, and we never put user input into Supabase filter strings.

**Q: Why at most 5 connections?**
A: Up to 3 server copies times 5 stays well under the pooler's limit.
