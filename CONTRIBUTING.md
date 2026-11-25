# Contributing

How a team member picks up an issue and gets a commit on main. Your commits must come from your own GitHub account, made by you; nobody commits in your name.

## Once: set up git so your commits count

1. `git clone https://github.com/aryavsparihar/nh44-routeguard.git && cd nh44-routeguard`
2. Use the email on your GitHub account (GitHub → Settings → Emails), or your `…@users.noreply.github.com` address:
   ```bash
   git config user.name "Your Name"
   git config user.email "you@example.com"
   ```
   If this email isn't on your GitHub account, the commit won't show on your profile.
3. `npm ci` if you will run the app or tests. Most issues (translations, data checks, docs) need only a text editor.

You don't need the secret keys. To try the app, open Aryaveer's dev server from your phone or laptop on the same Wi-Fi (he shares the address), or the live link once it is up. Demo accounts and the code `424242` are in the README "Try it" table.

## For each issue

1. `git checkout main && git pull`
2. `git checkout -b <yourname>/<short-topic>`, e.g. `riya/hindi-review`
3. Make the change. Small commits, one idea each, in your own words:
   ```text
   fix(i18n): clearer Hindi for the HOLD advice

   The old wording read like an order. Refs #62
   ```
   Types: `feat`, `fix`, `docs`, `test`, `data`, `chore`. End the body with `Refs #<issue number>`.
4. Run what the issue says (for example `npm run i18n:check` or `python3 scripts/validate_incidents.py`).
5. `git push -u origin <branch>`, open a pull request using the template, and ask Aryaveer or another member to review.
6. After review it is merged with a merge commit (never squash), so your commits stay yours.

## Rules

- Never commit `.env` files or keys.
- No made-up numbers: every figure needs a source or a "measured on" date.
- RouteGuard is advisory, not an official police service. Keep the disclaimer.
- Read your own `docs/qna/<name>.md`, and change it into your own words. You will be asked about your part.
