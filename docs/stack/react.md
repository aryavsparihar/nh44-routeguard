# React 19

**In one line:** the library we build every screen with, out of small reusable pieces called components.

## What it is

React lets you describe a screen as components: functions that return what should appear. When data changes, React updates only the part of the screen that changed.

## Why we use it

- Next.js is built on it.
- Components let us reuse things like the risk badge, the zone list and the admin cards on many screens.
- Hooks (`useState`, `useEffect`) keep a screen's data and side effects tidy.

## Where it is in our project

| Path | What it holds |
| --- | --- |
| `src/ui/` | All components, grouped by screen: `risk/`, `advice/`, `board/`, `report/`, `me/`, `admin/`, `offline/` |
| `src/ui/api.ts` | `useApi()`, our hook to load data from the API with loading, error and refresh states |
| `src/ui/risk/RiskScreen.tsx` | The map screen: picks the time and hazard, shows the worst zone, the map and the zone list |

## How it works in RouteGuard

- **State:** `useState` holds what the user picked (e.g. the forecast time on the map).
- **Effects:** `useEffect` runs side work, e.g. the approvals list reloads every 20 seconds (`src/ui/admin/ApprovalsAdmin.tsx`).
- **Data loading:** `useApi(path)` returns `[result, retry, refresh]`. `result.state` is `loading`, `error` or `ready`.
- **Safety:** we never use `dangerouslySetInnerHTML` (a CI script fails the build if anyone does), so text from users can't become code on the page.

## Learn more

- https://react.dev/learn

## Questions you may be asked

**Q: What is a component?**
A: A function that returns part of the screen. For example `ZoneList` takes the risk rows and shows one row per zone.

**Q: What is a hook?**
A: A function starting with `use` that gives a component memory (`useState`) or lets it do something after showing (`useEffect`). We also wrote our own, like `useApi` and `useRisk`.

**Q: How do you stop a hacker putting a script into a report note?**
A: React shows text as text, never as HTML, and we never use `dangerouslySetInnerHTML`. CI checks for it on every pull request.

**Q: How does a screen get data from the server?**
A: With `useApi("/api/v1/...")`, which calls `fetch`, then shows a loading message, an error with a retry button, or the data.

**Q: Why React 19?**
A: It's the version Next.js 16 is built for, and it supports server components, which we use for most pages.
