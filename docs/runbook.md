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

Clerk test emails `name+clerk_test@example.com` take the code `424242` and send no real email. Create one per role (BUILD_PROMPT section 19). Set a role on a test user in Clerk → Users → the user → Metadata → **Public**: `{ "role": "agent" }`. This is only for test users; real users get roles through the onboarding and admin endpoints (A4).

Created so far (development instance):

| Email | Role | Created |
|---|---|---|
| `admin+clerk_test@example.com` | admin | 24 Nov 2026, to test A2 |

### 5. Check it works

1. `npm run dev`.
2. Get a session token for a test user. Sign-in screens come with A4; until then, use `@clerk/testing` or Clerk's Backend API. Session tokens are short-lived, so get a fresh one right before each try.
3. Call a protected route with the header `Authorization: Bearer <session token>` (and `Origin: http://localhost:3000` on POST/PATCH/DELETE).
   - No token → 401.
   - The wrong role → 403.
   - The right role → 200.

### When deploying (later)

The same three Clerk values go into Azure Container Apps secrets (BUILD_PROMPT section 4.1), never into the image or the repo. Production needs a Clerk **production** instance and a domain we own; that is a separate step on deploy day.
