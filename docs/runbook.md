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
   - Our own page `/sign-in` asks for the email and the code (all three languages). It needs only email + email code; if the dashboard also asks for a password, a name or legal consent at sign-up, our page shows "Could not sign in". Clerk's bot check for new accounts shows inside our page (`#clerk-captcha`).
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

### When deploying

The Clerk values go to Azure as described in "Deploy to Azure (first time)" below: the publishable key as a GitHub variable (it is built into the image), the secret key as a Container Apps secret. Never into the image or the repo. A Clerk **production** instance needs a domain we own; that is a separate step.

## App database login (ORM)

The web app talks to Postgres directly with Drizzle (`src/server/db`), logged in as `routeguard_app`. That login can't read anything by itself: every query switches to `anon` or `authenticated` first, so RLS applies (migration `20261125120000_app_db_role.sql`, `docs/decisions.md` "ORM"). The Python job and `seed.mjs` still use the secret key over HTTP.

Once per database, after the migration is applied. The quick way, in your own terminal (it sets a new random password, writes `DATABASE_URL` into `.env.local`, and never prints the password):

```bash
npm run db:set-app-password
```

Then skip to step 4. By hand instead:

1. Make a password on your Mac. It goes to your password manager, never into chat or git:

   ```bash
   openssl rand -hex 32 | pbcopy
   ```

2. Supabase → **SQL Editor**, paste the password between the quotes and run:

   ```sql
   alter role routeguard_app with password '<paste>';
   ```

3. Supabase → **Connect** → **Transaction pooler** (port 6543). Copy the URL, change the user part from `postgres.mzublcdqgntejkvvoozh` to `routeguard_app.mzublcdqgntejkvvoozh`, and put the password in. Add it to `.env.local` as `DATABASE_URL=...`.
4. Check it:

   ```bash
   npm run db:orm-check
   ```

   Every line should start with `ok`. It only reads, inside transactions it rolls back, and never prints the URL.

5. If the Azure app already exists, give it the URL as a secret (the two `database-url` commands in "Deploy to Azure" section 4), then:

   ```bash
   az containerapp update --name $APP --resource-group $RG --set-env-vars DATABASE_URL=secretref:database-url
   ```

To change the password later, repeat steps 1–3 and the `database-url` secret command, then restart the app's revision.

After every migration run `npm run db:types` and `npm run db:schema`; `npm run typecheck` fails if the two disagree.

## Job queue worker

Report and official-update writes put a job on the queue (`pgmq`, migration `20261125200000_jobs_queue.sql`). Every minute pg_cron runs `private.wake_job_worker()`, which calls `POST /api/v1/internal/jobs/run` through pg_net, but only when a job is waiting and only once Vault knows where the worker is. Until you do the steps below, jobs wait in the queue and nothing is lost.

Once, after the first deploy:

1. Make the secret on your Mac and copy it (never into chat or git):

   ```bash
   openssl rand -hex 32 | pbcopy
   ```

2. Give it to the app as a Container Apps secret, then point the env var at it:

   ```bash
   az containerapp secret set --name $APP --resource-group $RG --secrets jobs-secret=<paste>
   ```

   ```bash
   az containerapp update --name $APP --resource-group $RG --set-env-vars JOBS_SECRET=secretref:jobs-secret
   ```

   For your own machine, add `JOBS_SECRET=<paste>` to `.env.local` instead.

3. Supabase → **SQL Editor**. Paste the same secret and the app's address, and run:

   ```sql
   select vault.create_secret('<paste>', 'jobs_secret');
   select vault.create_secret('https://<app-address>/api/v1/internal/jobs/run', 'jobs_worker_url');
   ```

4. Check it: post a road report in the app, wait a minute, then in the SQL editor:

   ```sql
   select count(*) from pgmq.q_jobs;  -- 0 once the worker took it
   select status_code, created from net._http_response order by created desc limit 3;  -- 200
   ```

To change the secret, repeat steps 1–2 and run `select vault.update_secret((select id from vault.secrets where name = 'jobs_secret'), '<paste>');`.

Failed jobs: a job that fails 5 times moves to `job_dead_letters`, shown to admins on `/admin/jobs`. Fix the cause, then post the job again by hand if it still matters, e.g. `select private.enqueue_job('report.confirmed', '{"report_id": "<id>"}');`.

To pause the worker: `select cron.unschedule('jobs-worker');`. To start it again: `select cron.schedule('jobs-worker', '* * * * *', 'select private.wake_job_worker()');`.

## Risk job timing

The risk job (`.github/workflows/risk-job.yml`) runs on GitHub Actions. GitHub's own hourly schedule skipped most hours (it ran every 6 to 12 hours in November 2026), so Supabase starts it instead:

- `pg_cron` calls `private.dispatch_risk_job()` at **:07 and :37** every hour (migration `20261124210000_risk_job_scheduler.sql`). The function asks GitHub's API to start the workflow on `main`.
- Each automatic run skips if the last run is under 40 minutes old. So :07 runs, and :37 only runs if :07 failed (a retry).
- GitHub's own `7 * * * *` schedule is still there as a fallback, with the same skip rule.
- The **Run workflow** button always runs (its default is 0).

### The GitHub token (once, and again when it expires)

The function needs a GitHub token in Supabase Vault. Never paste it into chat, a file or the repo.

1. GitHub → your profile picture → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. Name: `routeguard-risk-scheduler`. Expiration: a custom date just after the round. Resource owner: you.
3. Repository access: **Only select repositories** → `nh44-routeguard`.
4. Permissions → Repository permissions → **Actions: Read and write**. Leave everything else at "No access". (Metadata: read-only is added by GitHub on its own.)
5. **Generate token** and copy it.
6. Supabase dashboard → project `mzublcdqgntejkvvoozh` → **Integrations** → **Vault** → **Add new secret**. Name: `github_risk_dispatch_token`, value: the token. Save.

To renew: generate a new token the same way and edit the secret's value in Vault. Nothing else changes.

### Is it working?

- GitHub → **Actions** → **Risk job**: runs labelled "workflow_dispatch" at about :07 every hour, green. Runs at :37 that say "skipped: the last run was … min ago" are normal.
- `/status` shows the last run under 60 minutes old.
- What GitHub answered (kept for a few hours), in the Supabase SQL editor:

  ```sql
  select created, status_code, left(content, 200) as content
  from net._http_response order by created desc limit 5;
  ```

  204 means GitHub started the run. 401 or 403 means the token is wrong, expired or missing "Actions: Read and write". No rows and a warning in the Postgres logs ("no github_risk_dispatch_token in Vault") means the secret is missing.
- The pg_cron history: `select start_time, status, return_message from cron.job_run_details order by start_time desc limit 5;`

### Before a demo

Press **Actions → Risk job → Run workflow** about 10 minutes before. If the weather service times out, run it once more.

## Health checks

- `GET /api/v1/health`: the server is up. No database call. 200 `{ "data": { "status": "ok" } }`.
- `GET /api/v1/health/ready`: the database answers, and how old the risk scores are: `last_run_at`, `data_age_minutes`, `stale` (over 90 minutes, or no run yet). 503 problem+json when the database can't be reached. Stale data is still a 200: the app works and shows the stale banner.
- `node scripts/smoke.mjs <url>` checks a running app from outside (health, ready, security headers, 401/404/405 problem+json). Add `REQUIRE_READY=1` to require the database. The deploy workflow runs it after every deploy; CI runs it against the Docker image on every PR.

## Deploy to Azure (first time)

The deploy workflow (`.github/workflows/deploy.yml`) does nothing until the repo variable `DEPLOY_ENABLED` is `true`. These steps create the Azure resources once. They spend credit, so do them on deploy day, not before (BUILD_PROMPT section 4.1). Keys are typed with `read -rs` so they never show on screen or in your shell history; never paste them into chat.

### 1. Tools and sign-in (your Mac)

```bash
brew install azure-cli
```

```bash
az login
```

```bash
az extension add --name containerapp --upgrade
```

```bash
az provider register --namespace Microsoft.App --wait
```

```bash
az provider register --namespace Microsoft.OperationalInsights --wait
```

### 2. Names used below

Paste this once into the terminal you use for the rest of the steps:

```bash
RG=rg-routeguard; LOC=centralindia; ENV=cae-routeguard; APP=routeguard; LAW=log-routeguard; ID=id-routeguard-deploy
```

If Azure for Students refuses `centralindia`, the error lists the allowed regions. Pick the nearest one, change `LOC`, and write it in `docs/decisions.md`.

### 3. Resource group, logs and environment

```bash
az group create --name $RG --location $LOC
```

Log Analytics with a 0.1 GB/day cap, so logs can't eat the credit:

```bash
az monitor log-analytics workspace create --resource-group $RG --workspace-name $LAW --location $LOC --quota 0.1
```

```bash
LAW_ID=$(az monitor log-analytics workspace show -g $RG -n $LAW --query customerId -o tsv); LAW_KEY=$(az monitor log-analytics workspace get-shared-keys -g $RG -n $LAW --query primarySharedKey -o tsv)
```

```bash
az containerapp env create --name $ENV --resource-group $RG --location $LOC --logs-workspace-id "$LAW_ID" --logs-workspace-key "$LAW_KEY"; unset LAW_KEY
```

### 4. The container app

Created with Microsoft's sample image first; the first deploy replaces it.

```bash
az containerapp create --name $APP --resource-group $RG --environment $ENV --image mcr.microsoft.com/k8se/quickstart:latest --ingress external --target-port 80 --cpu 0.5 --memory 1.0Gi --min-replicas 0 --max-replicas 3
```

(The sample image listens on port 80. The first deploy switches the app to our image and port 3000.)

Pulling our private image from GitHub Container Registry needs a **classic** GitHub token with only `read:packages`: GitHub → Settings → Developer settings → Personal access tokens → **Tokens (classic)** → Generate new token (classic), tick only `read:packages`, expiry just after the round. Then:

```bash
read -rs GHCR_TOKEN
```

(paste the token, press Enter; nothing is shown)

```bash
az containerapp registry set --name $APP --resource-group $RG --server ghcr.io --username aryavsparihar --password "$GHCR_TOKEN"; unset GHCR_TOKEN
```

The Clerk secret key, as a Container Apps secret:

```bash
read -rs CLERK_SECRET
```

```bash
az containerapp secret set --name $APP --resource-group $RG --secrets clerk-secret-key="$CLERK_SECRET"; unset CLERK_SECRET
```

The database URL (with the `routeguard_app` password, "App database login" above), also as a secret:

```bash
read -rs DATABASE_URL_VALUE
```

```bash
az containerapp secret set --name $APP --resource-group $RG --secrets database-url="$DATABASE_URL_VALUE"; unset DATABASE_URL_VALUE
```

Environment variables. The `NEXT_PUBLIC_` values are public (they are in the browser bundle anyway); copy them from your `.env.local` in your editor:

```bash
az containerapp update --name $APP --resource-group $RG --set-env-vars CLERK_SECRET_KEY=secretref:clerk-secret-key DATABASE_URL=secretref:database-url NEXT_PUBLIC_SUPABASE_URL=<url> NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key> NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<pk_...> NEXT_PUBLIC_CLERK_KEYLESS_DISABLED=1 NEXT_PUBLIC_CLERK_TELEMETRY_DISABLED=1 LOG_LEVEL=info
```

### 5. Let GitHub deploy without a password

A managed identity that GitHub Actions on `main` can sign in as, allowed to change only this resource group:

```bash
az identity create --resource-group $RG --name $ID --location $LOC
```

```bash
az identity federated-credential create --resource-group $RG --identity-name $ID --name github-main --issuer https://token.actions.githubusercontent.com --subject repo:aryavsparihar/nh44-routeguard:ref:refs/heads/main --audiences api://AzureADTokenExchange
```

```bash
az role assignment create --assignee-object-id $(az identity show -g $RG -n $ID --query principalId -o tsv) --assignee-principal-type ServicePrincipal --role Contributor --scope $(az group show -n $RG --query id -o tsv)
```

### 6. GitHub secrets and variables

```bash
gh secret set AZURE_CLIENT_ID --body "$(az identity show -g $RG -n $ID --query clientId -o tsv)"
```

```bash
gh secret set AZURE_TENANT_ID --body "$(az account show --query tenantId -o tsv)"
```

```bash
gh secret set AZURE_SUBSCRIPTION_ID --body "$(az account show --query id -o tsv)"
```

```bash
gh variable set AZURE_RESOURCE_GROUP --body $RG; gh variable set AZURE_CONTAINERAPP_NAME --body $APP
```

The three public values that are built into the image (replace the placeholders as in step 4):

```bash
gh variable set NEXT_PUBLIC_SUPABASE_URL --body "<url>"; gh variable set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY --body "<publishable key>"; gh variable set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY --body "<pk_...>"
```

Then switch deploys on:

```bash
gh variable set DEPLOY_ENABLED --body true
```

### 7. First deploy

GitHub → Actions → **Deploy** → Run workflow (branch `main`). It builds the image, updates the app with the scaling settings (0 to 3 replicas, one more per 80 requests in flight), waits for it to answer and runs the smoke test with the database required. From then on, every merge to `main` deploys.

Get the URL:

```bash
az containerapp show -n $APP -g $RG --query properties.configuration.ingress.fqdn -o tsv
```

Optional: in the Azure portal, open the container app → Containers → Health probes and add a **liveness** probe: HTTP GET `/api/v1/health` on port 3000. Don't use `/api/v1/health/ready` for any probe (`docs/decisions.md`, A7).

### 8. Budget alert

Azure portal → **Cost Management** → **Budgets** → **Add**: scope your subscription, amount US$10, monthly, alerts at 50%, 90% and 100% to your email.

### Before the demo

With 0 replicas the first visit starts the app, which takes a few seconds. A few minutes before presenting, open the app and run:

```bash
REQUIRE_READY=1 node scripts/smoke.mjs https://<app url>
```

If it warns that the data is stale, press **Run workflow** on **Risk job** too.

### If a deploy breaks the app

Roll back to the previous image: GitHub → Actions → Deploy → open the last green run → **Re-run all jobs**. Or in the portal: container app → Revisions → activate the previous revision.

### After the round

Delete everything in one go so the rest of the credit stays (asks to confirm):

```bash
az group delete --name rg-routeguard
```
