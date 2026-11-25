# Clerk (sign-in)

**In one line:** Clerk handles signing in with a one-time email code and tells our server and database who you are and what role you have.

## What it is

Clerk is a sign-in service. It shows the sign-in form, sends the code, keeps the session and gives the app a signed token (a JWT) with your user id. We use `@clerk/nextjs` 7.9.25 on Clerk's free Hobby plan.

## Why we use it

- No passwords to store or leak. Sign-in is a one-time code sent by **email**.
- Built-in bot protection on the sign-in form.
- Supabase reads Clerk's session token directly (Supabase's native Clerk integration), so the database knows who is calling.

We chose email codes, not SMS: SMS is a paid Clerk feature, and we don't spend money. The app says "email" everywhere and never "phone".

## Where it is in our project

| Path | What it does |
| --- | --- |
| `proxy.ts` | `clerkMiddleware()` reads the session; sends signed-out visitors of `/board`, `/report/new`, `/me`, `/admin` to `/sign-in` |
| `src/server/http/caller.ts` | Reads the user id and the `metadata.role` claim from the token |
| `src/server/auth/page.ts` | `requirePageRole([...])`, the role check at the top of every protected page |
| `src/server/clerk/users.ts` | Server-only calls to Clerk: set a role, read emails for the TCU list |
| `app/[locale]/sign-in/` | The sign-in page |
| `app/api/v1/me/realtime-token/route.ts` | Gives the board the caller's own short-lived token for Supabase Realtime |

## How it works in RouteGuard

1. You sign in with your email and the code.
2. On `/me` you pick your role (grower, trader, agent or driver), type your name and send it **to TCU**. The account is saved as `pending`.
3. TCU (the admin) approves it on `/admin/approvals`. Only then does the server write your role into Clerk's `publicMetadata.role`. Users can't edit that from the browser.
4. Clerk puts the role into the session token as `metadata.role`. The API reads it, and the database checks it again with `private.jwt_role()`: the role only counts if your `users` row has the same role and is approved.

Roles: grower, trader, agent, driver, admin (shown as "TCU"). Police was merged into TCU, and the app can never grant admin.

**The order matters:** role changes write the database first, then Clerk. If Clerk failed in between, sending the same approval again fixes it.

## Test accounts

Emails with `+clerk_test` (e.g. `someone+clerk_test@example.com`) are Clerk test addresses. They get no real email; the code is `424242`. The demo accounts are made by `npm run db:seed-demo`.

## Learn more

- https://clerk.com/docs/references/nextjs/overview
- https://supabase.com/docs/guides/auth/third-party/clerk

## Questions you may be asked

**Q: Why not build your own login?**
A: Storing passwords safely, sending codes and stopping bots is a lot of security work. Clerk does it, and we store no passwords at all.

**Q: Can a user make themselves admin?**
A: No. The role sits in Clerk's public metadata, which only our server can write. Our server never grants admin, and the database ignores a token role that doesn't match an approved `users` row.

**Q: Why does a new account have to wait for TCU?**
A: So only real growers, traders, agents and drivers get access to shipment data. Until TCU approves, the token carries no role and the database treats you as a plain signed-in user.

**Q: Why email and not a phone OTP?**
A: SMS costs money on Clerk. Email codes are free and still have no password.

**Q: Where is the Clerk secret key?**
A: Only on the server, in environment variables, in modules that start with `import "server-only"`. CI searches the browser bundle for key-shaped text and fails if it finds any.
