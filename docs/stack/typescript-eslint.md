# TypeScript and ESLint

**In one line:** TypeScript catches type mistakes before the code runs; ESLint catches bad patterns and style problems.

## What they are

- **TypeScript** is JavaScript with types. If a function expects a number and you pass text, the editor and `npm run typecheck` show an error before anyone runs the app.
- **ESLint** reads the code and warns about risky or sloppy patterns, like a React hook used in the wrong place.

## Why we use them

- The app, API and tests are all TypeScript, so one wrong field name is caught at once.
- Types are generated from the real database (`lib/database.types.ts`), so code and database can't silently disagree.
- Both run in CI on every pull request.

## Where they are in our project

| Path | What it holds |
| --- | --- |
| `tsconfig.json` | TypeScript settings (strict mode) |
| `eslint.config.mjs` | ESLint rules, based on `eslint-config-next` |
| `lib/database.types.ts` | Types generated from Supabase (`npm run db:types`) |
| `src/server/db/schema.typecheck.ts` | A check that fails the typecheck if the Drizzle schema and the database types disagree |
| `src/shared/api-types.ts` | Types for API answers, shared by server and browser |

## Commands

```bash
npm run typecheck   # next typegen, then tsc --noEmit: type errors only, no output files
npm run lint        # ESLint
npm run db:types    # regenerate database types after a migration
npm run db:schema   # regenerate the Drizzle schema to match
```

## Learn more

- https://www.typescriptlang.org/docs/
- https://eslint.org/docs/latest/

## Questions you may be asked

**Q: Why TypeScript instead of JavaScript?**
A: It finds mistakes like a wrong field name or a missing value while we write the code, not when a driver is using the app.

**Q: How do you keep the code and the database in sync?**
A: After each migration we run `npm run db:types` and `npm run db:schema`. `schema.typecheck.ts` then makes the typecheck fail if a table's columns differ between the two.

**Q: What does ESLint catch that TypeScript doesn't?**
A: Patterns that are valid code but likely bugs, for example hooks called inside an `if`, or unused variables.

**Q: Do the types exist when the app runs?**
A: No. Types are removed when the code is built. That's why we also check every input at runtime with zod.
