# Translation review

BUILD_PROMPT sections 9 and 12: safety text (SEND/HOLD/RAIL/DIVERT,
warnings, disclaimers, consent screens) must be checked by a fluent Hindi
reader and a fluent Urdu reader before we rely on it. Until a row below has a
name and a date, treat that text as a draft.

The Hindi (`hi.json`) and Urdu (`ur.json`) strings were machine-drafted on
2026-11-25. **None of them has been reviewed by a fluent reader yet.**

| Section | Hindi reviewed by (date) | Urdu reviewed by (date) | Notes |
| --- | --- | --- | --- |
| `footer.disclaimer` (safety) | not yet reviewed | not yet reviewed | Must say clearly: not official, follow J&K Traffic Police, call 112 |
| `privacy.*` (consent) | not yet reviewed | not yet reviewed | Legal meaning matters; keep "DPDP Act, 2023" |
| `banner.*` | not yet reviewed | not yet reviewed | |
| `header.*`, `nav.*`, `home.*`, `notFound.*`, `meta.*` | not yet reviewed | not yet reviewed | |

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
