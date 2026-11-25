# Next.js 16

**In one line:** the framework that runs our whole web app: the pages people see and the API behind them, in one project.

## What it is

Next.js is a framework built on React. You write pages and API routes as files in the `app/` folder, and Next.js turns them into a website. It can build a page on the server (fast first load, good on slow phones) and then make it interactive in the browser.

## Why we use it

- One codebase for pages and APIs, written in TypeScript. A small team doesn't need a separate backend project.
- Server rendering makes the first screen load quickly on a slow 3G/4G phone on NH-44.
- Built-in font loading, image handling and caching.
- It builds a small standalone server (`output: "standalone"`) that fits in a Docker container.

## Where it is in our project

| Path | What it holds |
| --- | --- |
| `app/[locale]/` | The pages: `/` (map), `/strip`, `/advisor`, `/board`, `/report/new`, `/me`, `/admin/...` |
| `app/api/v1/` | Every API route, e.g. `app/api/v1/risk/route.ts` |
| `proxy.ts` | Runs before each request: Clerk sign-in check and language choice. Next 16 renamed "middleware" to "proxy" |
| `next.config.ts` | Settings: `output: "standalone"`, `cacheComponents: true`, security headers, `allowedDevOrigins` |
| `node_modules/next/dist/docs/` | The docs for our exact version. Read these before using a Next API (CLAUDE.md rule) |

## How it works in RouteGuard

- **Pages** are server components by default. A file that starts with `"use client"` runs in the browser too (for buttons, forms, the map).
- **Routes** export functions named after the HTTP method: `export const GET = withApi(...)`.
- **`[locale]`** in the folder name means the page exists in `en`, `hi` and `ur`. The URL stays `/board`; the language comes from the `rg_lang` cookie.
- **Next 16 changes we rely on:** `proxy.ts` instead of `middleware.ts`, `await auth()`, `await params` (route params are a Promise now), and `cacheComponents` (parts of a page can be cached, and anything that reads the session sits inside `<Suspense>`).

## Commands

```bash
npm run dev      # development server on http://localhost:3000
npm run build    # production build (CI runs this)
npm start        # run the production build
```

## Learn more

- Official docs: https://nextjs.org/docs
- Our version's docs: `node_modules/next/dist/docs/`

## Questions you may be asked

**Q: Why Next.js and not plain React?**
A: Plain React only runs in the browser. Next.js also renders on the server and gives us API routes, so the pages and the backend live in one project and the first screen loads faster on slow phones.

**Q: What is the difference between a server component and a client component?**
A: A server component runs only on the server and sends finished HTML. A client component (`"use client"`) also runs in the browser, so it can react to taps. We keep most pages on the server and make only the interactive parts client components.

**Q: What does `proxy.ts` do?**
A: It runs before every page request. It checks the Clerk session, sends signed-out visitors of protected pages to `/sign-in`, and picks the language. The real permission checks are still in each API route and page.

**Q: Where are your API routes?**
A: In `app/api/v1/`. Each folder is one URL, and the `route.ts` file inside it exports `GET`, `POST` and so on, all wrapped in our `withApi()` helper.

**Q: What does `output: "standalone"` mean?**
A: The build copies only the files the server needs into `.next/standalone`. Our Docker image runs that, so the image stays small.

**Q: Why are route params awaited (`await params`)?**
A: In Next.js 16, `params` is a Promise, so pages and routes must `await` it before reading the id.
