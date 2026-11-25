# GitHub Actions (CI, gitleaks, npm audit)

**In one line:** GitHub Actions runs our checks on every pull request and runs the hourly risk job, all on GitHub's machines for free.

## What it is

GitHub Actions runs "workflows": lists of steps in a YAML file, started by an event (a pull request, a merge, a timer, or a button).

## Why we use it

- Nothing broken gets merged: a pull request can only be merged when CI is green.
- Free for our repository, and it needs no server of our own.

## Our three workflows

| File | When | What |
| --- | --- | --- |
| `.github/workflows/ci.yml` | Every pull request and every push to `main` | All the checks below |
| `.github/workflows/risk-job.yml` | Started by Supabase at :07 and :37, GitHub schedule as fallback, or by hand | The hourly risk job ([python-risk-job.md](python-risk-job.md)) |
| `.github/workflows/deploy.yml` | Push to `main`, **only if** the repo variable `DEPLOY_ENABLED` is `true` | Build the image, push to GHCR, update Azure ([azure-container-apps.md](azure-container-apps.md)). Off for now |

## What CI checks

**Web app job**

1. `npm audit`: no high-severity problems in any package, no moderate ones in production packages.
2. Every env var the app reads is listed in `.env.example`.
3. No `dangerouslySetInnerHTML`.
4. No raw SQL outside `src/server/db`.
5. Translations match in English, Hindi and Urdu.
6. Lint and typecheck.
7. Vitest with coverage.
8. Production build.
9. No secret keys in the browser bundle or prerendered pages.

**Docker job:** builds the image with no keys, starts it, smoke-tests it, runs the Postman folders with newman and the Playwright phone tests, and checks there are no `.env` files or keys in the image.

**pytest job:** the Python tests on Python 3.12.

**gitleaks job:** scans the whole git history for secrets that were committed by mistake.

## Learn more

- https://docs.github.com/en/actions
- https://github.com/gitleaks/gitleaks

## Questions you may be asked

**Q: What happens if someone commits an API key?**
A: gitleaks scans every commit in the pull request and fails CI. If a key ever leaked, we would also revoke it at the provider, because deleting a commit doesn't remove it from copies.

**Q: Why does CI have no database or Clerk keys?**
A: On purpose. Pull requests could come from forks, so CI never holds secrets. Tests that need keys mock them or run locally.

**Q: What does `npm audit` do?**
A: It checks every package we use against a list of known security problems.

**Q: Why is deploy switched off?**
A: The Azure resources aren't created yet. Without the switch, every merge to `main` would fail the deploy.
