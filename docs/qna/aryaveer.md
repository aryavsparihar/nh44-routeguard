# Aryaveer: backend lead, data, security, reviews (Step 0, WP-A)

**What I own:** `withApi()` and the HTTP layer (`src/server/http/`), Clerk ↔ Supabase (`src/server/clerk/`, `proxy.ts`), migrations and RLS (`supabase/migrations/`, `supabase/tests/rls.test.sql`), roles and the audit log, security headers (`src/server/security-headers.ts`), the risk job's `reason_code` (`jobs/`), health and readiness (`src/server/health/`), the backtest (`jobs/backtest.py`), CI and the deploy workflow.

**A request I can trace:** `PATCH /api/v1/admin/users/{id}/role` → `proxy.ts` → `withApi({ access: ["admin"], rateLimit: "role" })` checks the Clerk session and role (401/403), the Origin (CSRF), 5 attempts an hour, then a strict zod body with a required reason → one database transaction that switches to the caller's role so RLS applies, updates `users.role`, writes `audit_log` through `public.write_audit()` → Clerk `publicMetadata.role` is set last → 200 with the request id.

**A test and what it proves:** `app/api/routes.test.ts` fails if any route file exports a handler not wrapped in `withApi()`. So nobody can add a route that skips auth, validation and problem+json errors.

**A decision and what we rejected:** RLS on every table, with the app logging in as `routeguard_app`, which can read nothing until each request switches to `anon` or `authenticated` with the caller's verified Clerk claims. Rejected: the Supabase service key in the app, which skips RLS; one forgotten check would leak everything.

**A limitation and the fix:** Clerk runs as a development instance (the "Development mode" label, test emails). Fix: a production Clerk instance on our own domain once we have one, which needs DNS records.
