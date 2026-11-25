# RouteGuard UI and Languages

> The design system and multilingual layer of NH-44 RouteGuard: Tailwind CSS 4 styling, next-intl translations, right-to-left Urdu and self-hosted fonts, built for 360 px phones.

**Advisory only.** RouteGuard is not an official police service. Follow J&K Traffic Police. In an emergency call **112**.

---

## Why this exists

RouteGuard's users are apple growers, traders, agents and drivers on mobile phones, often on slow networks, and many read Hindi or Urdu rather than English. This part of the frontend makes sure every screen is readable, consistent and usable in all three languages on a small screen.

## What it covers

- **Design tokens**: one shared palette and spacing scale used by every screen.
- **Tailwind CSS 4** styling, mobile-first.
- **Three languages**: English, Hindi and Urdu, with the same translation keys in each.
- **Right-to-left layout** for Urdu.
- **Self-hosted fonts** loaded per language.
- **Icons** generated from SVG files.
- **Shared status elements**: header with language switch, stale-data banner, bottom navigation, footer disclaimer.

## Design system

Colours and spacing come from one tokens file, `docs/ux/data/tokens.json`, and feed Tailwind's theme so the whole app shares one look.

| Token colour | Meaning |
|---|---|
| Highway green | Primary brand and safe state |
| Milestone yellow | Caution and highlights |
| Apple red | Danger and high risk |
| Rail blue | Rail and parcel-train information |

### Tailwind approach

- Utility classes written directly in components, so styles live next to the markup.
- **Mobile-first**: base classes target a 360 px phone, larger screens add prefixes.
- Repeated patterns are wrapped in React components in `src/ui/` instead of copy-pasted class lists.
- Only the classes actually used are shipped, which keeps CSS small on slow connections.
- Logical spacing (start and end instead of left and right) so layouts flip correctly for Urdu.

## Internationalisation

| Item | Detail |
|---|---|
| Library | next-intl |
| Languages | English (`en`), Hindi (`hi`), Urdu (`ur`) |
| Message files | `messages/en.json`, `messages/hi.json`, `messages/ur.json` |
| Keys | The same keys in all three files; `npm run i18n:check` counts them |
| Language choice | Stored in the `rg_lang` cookie, never shown in the URL |
| Direction | Urdu is right-to-left, English and Hindi left-to-right |
| Digits | Latin digits in all three languages |
| Review tracking | `messages/REVIEW.md` tracks translation review |

A CI check fails the build if the three message files do not have exactly the same keys, so a screen can never ship with missing text in one language.

### Reason codes become sentences

The advisor works with reason codes (for example why a lot should be held). `reason.ts` in `src/shared/` turns each code into a translated sentence, so the same advice reads correctly in all three languages.

## Fonts

Fonts are set up in `src/ui/fonts.ts` with `next/font`, which downloads them at build time and serves them from our own site, so no request goes to a font service when someone opens the app:

- **Atkinson Hyperlegible** for body text and **Barlow Semi Condensed** for headings (Latin script, from the Round 2 style guide)
- **Noto Sans Devanagari** for Hindi
- **Noto Nastaliq Urdu** for Urdu, with a taller line height because Nastaliq is tall

The Hindi and Urdu fonts are not preloaded: a phone downloads them only when a page in that language draws their letters.

## Icons

SVG icons live in `docs/ux/assets/icons/`. `scripts/ui/gen-icons.mjs` converts them into `src/ui/icons.tsx`, so they ship as inline React components that take the text colour, with no extra network requests.

## Screens that use this layer

| Route | Screen |
|---|---|
| `/` | Map with worst-zone card, filters, zone list, updates and road reports |
| `/strip` | 48-hour view |
| `/advisor` | SEND / HOLD / RAIL / DIVERT advice |
| `/board` | Agent board: shipments, drivers and live updates |
| `/report/new` | Road report form |
| `/me` | Account: role, name, language, location sharing, alerts, optional Aadhaar check |
| `/sign-in` | Sign in with an email code |
| `/admin/*` | TCU screens |
| `/privacy`, `/status` | Privacy notice and system status |

Every page shows a header with the language switch, a stale-data banner, a bottom navigation bar (Map, 48 h, Advisor, Board, Report) and the disclaimer footer.

## Tech

- Next.js 16 (App Router) and React 19
- Tailwind CSS 4
- next-intl 4
- TypeScript
- MapLibre GL with OpenFreeMap for the map

## Folder layout

```
messages/           en.json, hi.json, ur.json, REVIEW.md
src/i18n/           Language routing
src/ui/             Client components, fonts.ts and the generated icons.tsx
src/shared/         reason.ts, format.ts, freshness.ts and other shared code
docs/ux/data/       tokens.json
docs/ux/assets/     SVG icons
app/[locale]/       Pages
```

## Design principles

1. **Phone first**: everything works at 360 px.
2. **Readable in any language**: proper fonts and direction for each script.
3. **Honest data**: dates and times in IST, with a banner showing how old the data is.
4. **Light on data**: self-hosted fonts loaded per language, small CSS output.
5. **Consistent**: one palette, one spacing scale, shared components.

## Disclaimer

RouteGuard provides advisory information based on weather forecasts and community reports. It is not an official police or government service. Always follow J&K Traffic Police, and call 112 in an emergency.
