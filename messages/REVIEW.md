# Translation review

BUILD_PROMPT sections 9 and 12: safety text (SEND/HOLD/RAIL/DIVERT,
warnings, disclaimers, consent screens) must be checked by a fluent Hindi
reader and a fluent Urdu reader before we rely on it. Until a row below has a
name and a date, treat that text as a draft.

The Hindi (`hi.json`) and Urdu (`ur.json`) strings were machine-drafted on
2026-11-25. **None of them has been reviewed by a fluent reader yet.**

| Section | Hindi reviewed by (date) | Urdu reviewed by (date) | Notes |
| --- | --- | --- | --- |
| `reason.places.*`, `risk.mapPlaces.*` (place names) | not yet reviewed | not yet reviewed | Town names on the map and in risk reasons. Check local spellings (e.g. Banihal: बनिहाल / بانہال, Qazigund: क़ाज़ीगुंड / قاضی گنڈ) |
| `risk.hexNote` | not yet reviewed | not yet reviewed | |
| `footer.disclaimer` (safety) | not yet reviewed | not yet reviewed | Must say clearly: not official, follow J&K Traffic Police, call 112 |
| `privacy.*` (consent) | not yet reviewed | not yet reviewed | Legal meaning matters; keep "DPDP Act, 2023" |
| `banner.*` | not yet reviewed | not yet reviewed | |
| `header.*`, `nav.*`, `home.*`, `notFound.*`, `meta.*` | not yet reviewed | not yet reviewed | |
| `risk.*`, `strip.*`, `summary.*` (risk levels) | not yet reviewed | not yet reviewed | Levels must read as advice, not as a road status |
| `reason.*` (why a zone is risky) | not yet reviewed | not yet reviewed | Hazard words and units (mm, cm, m, °C); `places.*` stay English for now |
| `advice.*` (safety: SEND/HOLD/RAIL/DIVERT) | not yet reviewed | not yet reviewed | Must not sound like an order or a road status; "check with TCU / Northern Railway" must stay clear |
| `updates.*`, `reports.*` | not yet reviewed | not yet reviewed | "Closure", "one-way" must match what J&K Traffic Police say |
| `report.*`, `reports.actions.*` (report screen, consent) | not yet reviewed | not yet reviewed | Safety and consent text: "photograph the road, not people", the location consent and "I see it too" must read clearly |
| `admin.*` (admin and police screens) | not yet reviewed | not yet reviewed | Only admins and the demo police account see these; `updates.notOfficial` is safety text |
| `board.*`, `advice.save.*` (shipment board) | not yet reviewed | not yet reviewed | Location-sharing text ("the stretch of road, not your exact spot") and the vouch warning are consent and safety text |
| `auth.*`, `me.*` (sign-in, account, consent, deletion) | not yet reviewed | not yet reviewed | Consent and deletion text: "we deleted your last position", "this can't be undone" must be exact |
| `offline.*`, `report.queued`, `board.savedCopy`, `me.signOutWaiting`, and `public/offline.html` | not yet reviewed | not yet reviewed | Tells people a report is saved and will send by itself; must not promise it was sent |
| `push.*`, `me.alerts.*`, `privacy.collectAlerts` (alerts) | not yet reviewed | not yet reviewed | Alert text arrives on a locked phone: "confirmed" and the advisory line must be exact; the privacy line is consent text |

## Choices for the reviewers

- **Digits:** Latin digits (0–9) in all three languages, so truck numbers and
  times read the same everywhere. Change `intlLocale()` in
  `src/i18n/locale.ts` if the Urdu reviewer prefers Urdu digits.
- **Urdu font:** Noto Nastaliq Urdu with line height 1.9. If it is too tall
  on a small phone, switch to Noto Naskh Arabic in `src/ui/fonts.ts`.
- **Place and zone names:** kept in English spelling until a reviewer
  confirms the Hindi and Urdu spellings. Don't trust a machine for these.
- **Role words:** grower = उत्पादक / کاشتکار, trader = व्यापारी / تاجر,
  agent = एजेंट / ایجنٹ, driver = ड्राइवर / ڈرائیور.

## How to review

1. Switch the app to the language (top right) and read every screen.
2. Fix wording in `messages/hi.json` or `messages/ur.json`. Keep the
   `{placeholders}` exactly as they are; `npm run i18n:check` fails otherwise.
3. Put your name and the date in the table above, in the same commit.
