# Runbook

Steps a person does by hand: dashboards, keys, and what to do when something breaks. Claude writes the steps; Aryaveer does them.

## Clerk and Supabase: one-time setup

Clerk handles login and roles. Supabase reads the same Clerk session token, so the database (RLS) sees who is signed in. The code is in place (A2); these steps switch it on. Until they are done, the app runs with everyone signed out.

Use the Clerk application **`app_3MY5xJ8fczFe0sOEafACBTW6tNY`**. Don't create a new one and don't switch to another.

### 1. Clerk dashboard (development instance)

1. **Name:** Settings → rename the application to "RouteGuard".
2. **Sign-in methods:** User & authentication:
   - Turn on **email address** with **email verification code** (no password).
   - Leave **phone number / SMS** off. On our free Hobby plan SMS is a paid feature (checked 24 Nov 2026), and we don't spend money on it. The app must say "email", never "phone" (BUILD_PROMPT section 8).
   - The dashboard's "paid features" note should then no longer list SMS.
3. **Role in the session token:** Sessions → Customize session token → add:
   ```json
   { "metadata": "{{user.public_metadata}}" }
   ```
   The server reads the role from `metadata.role`. Without this step every user counts as "no role".
4. **Supabase integration:** open the Clerk Supabase setup page (dashboard.clerk.com/setup/supabase), choose **Activate Supabase integration**, and copy the **Clerk domain** it shows. This adds the `role: authenticated` claim Supabase needs.

### 2. Supabase dashboard (project `mzublcdqgntejkvvoozh`)

1. Authentication → Sign In / Providers → **Third-party auth** → **Add provider** → **Clerk**.
2. Paste the Clerk domain from step 1.4 and save.

### 3. Keys on your machine

Put these in `.env.local` yourself (never in chat, never committed):

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: Clerk → API keys → publishable key.
- `CLERK_SECRET_KEY`: Clerk → API keys → secret key. It's shown only once; keep it in your password manager.
- `NEXT_PUBLIC_CLERK_KEYLESS_DISABLED=1`
- `NEXT_PUBLIC_CLERK_TELEMETRY_DISABLED=1` (Clerk otherwise sends SDK usage data from development)

`.env.example` lists every name with a comment.

### 4. Test users (ask the team first)

Clerk test emails `name+clerk_test@example.com` take the code `424242` and send no real email. Create one per role (BUILD_PROMPT section 19). Give a test user a role the same way real users get one: they call `POST /api/v1/me/onboarding` (grower, trader, agent, driver), or an admin calls `PATCH /api/v1/admin/users/{id}/role` with a reason (any role, audited). Don't set roles by hand in the Clerk dashboard any more: that skips our `users` row and the audit log. The one exception is the first admin, below.

Created so far (development instance):

| Email | Role | Created |
|---|---|---|
| `admin+clerk_test@example.com` | admin | 24 Nov 2026, to test A2 |
| `driver+clerk_test@example.com` | driver (onboarded through the API) | 24 Nov 2026, to test A4 |

### 5. Check it works

1. `npm run dev`.
2. Get a session token for a test user. Until the sign-in screens exist (D2), use `@clerk/testing` or Clerk's Backend API. Session tokens are short-lived, so get a fresh one right before each try.
3. Call a protected route with the header `Authorization: Bearer <session token>` (and `Origin: http://localhost:3000` on POST/PATCH/DELETE).
   - No token → 401.
   - The wrong role → 403.
   - The right role → 200.

### 6. The first admin (once per database)

police and admin are never self-service, and only an admin can grant them. So the very first admin needs a hand-made start:

1. In Clerk → Users → the admin user → Metadata → **Public**: `{ "role": "admin" }`.
2. Give them a `users` row and an audit entry. Ask the team first, then run (replace the id):
   ```sql
   begin;
   insert into public.users (id, role, verification_level)
     values ('user_REPLACE_ME', 'admin', 'official')
     on conflict (id) do update set role = 'admin', verification_level = 'official';
   insert into public.audit_log (actor_id, actor_role, action, target_type, target_id, reason)
     values (null, 'bootstrap', 'user.role_changed', 'user', 'user_REPLACE_ME', 'Bootstrap: first admin, set by hand');
   commit;
   ```
   with `npx supabase db query --remote -f <file>`. It runs as the database owner, so RLS doesn't stop it.

Every later admin is made by an existing admin through the API.

Done for the development project on 24 Nov 2026: `admin+clerk_test@example.com` has its row (audit entry with actor role `bootstrap`).

### 7. After a role change

The new role is in the user's session token only after it refreshes (up to about a minute). The app calls `getToken({ skipCache: true })` after onboarding; for anyone else, "refresh to see your new role". Responses from both role endpoints include `token_refresh_needed: true`.

### When deploying (later)

The same three Clerk values go into Azure Container Apps secrets (BUILD_PROMPT section 4.1), never into the image or the repo. Production needs a Clerk **production** instance and a domain we own; that is a separate step on deploy day.
