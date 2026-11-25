# next-intl (English, Hindi, Urdu)

**In one line:** the library that shows every word in the app in the user's language.

## What it is

next-intl is a translation library for Next.js. Each language has a file of messages (keys and text). Components ask for a key, like `t("approve")`, and get the text in the current language.

## Why we use it

- Drivers, growers and agents on NH-44 read Urdu, Hindi or English. The whole app, including errors and sign-in, works in all three.
- It handles plurals ("1 minute ago" / "5 minutes ago") and numbers inside sentences.
- It works in both server and client components.

## Where it is in our project

| Path | What it holds |
| --- | --- |
| `messages/en.json`, `hi.json`, `ur.json` | Every string, same keys in all three files |
| `src/i18n/routing.ts` | The three locales and how the URL is handled |
| `proxy.ts` | Picks the language from the `rg_lang` cookie (or the phone's language on a first visit) |
| `src/ui/LanguageSwitch.tsx` | The English / हिन्दी / اردو buttons in the header |
| `docs/ui-languages.md` | Rules for wording and right-to-left layout |

## How it works in RouteGuard

- The URL stays the same (`/board`); the proxy rewrites it inside the server to `/ur/board` when the cookie says Urdu.
- Urdu pages get `dir="rtl"` so the layout mirrors.
- Numbers and the "+48 h" label are wrapped so they stay readable inside right-to-left text.
- `npm run i18n:check` fails if any key is missing in one of the three files. CI runs it.

## Commands

```bash
npm run i18n:check   # same keys in en, hi and ur
```

## Learn more

- https://next-intl.dev/docs

## Questions you may be asked

**Q: How do you add a new sentence to the app?**
A: Add the same key to `en.json`, `hi.json` and `ur.json`, use `t("key")` in the component, and run `npm run i18n:check`.

**Q: Who checked the translations?**
A: Team members, not professional translators. We say so in the Q&A notes.

**Q: How does the app know which language to show?**
A: The `rg_lang` cookie, set by the language buttons. On a first visit it uses the phone's language.

**Q: What happens if a key is missing in Urdu?**
A: CI fails the pull request, so it can't be merged.

**Q: Why not put the language in the URL, like `/ur/board`?**
A: A shared link then works for everyone in their own language, and the address stays short.
