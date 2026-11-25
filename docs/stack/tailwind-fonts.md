# Tailwind CSS 4 and our fonts

**In one line:** Tailwind lets us style the app with short class names right in the components; four Google fonts make English, Hindi and Urdu easy to read.

## What it is

Tailwind CSS is a set of small ready-made styles. Instead of writing a CSS file, you write classes like `rounded-lg p-3 font-bold` on the element. Only the classes we use end up in the final CSS file.

## Why we use it

- Fast to build mobile screens with consistent spacing and colours.
- Small CSS download, which matters on slow networks.
- Our colours are defined once as design tokens (e.g. `--color-highway`, `--color-high-fill`) and used everywhere.
- `ps-`/`pe-`/`ms-` classes (start/end instead of left/right) flip correctly for Urdu, which reads right to left.

## Where it is in our project

| Path | What it holds |
| --- | --- |
| `app/globals.css` | Tailwind import and our colour tokens (risk low/medium/high, highway green, text colours) |
| `src/ui/admin/common.tsx` | Shared classes: `buttonClass`, `inputClass`, `quietButtonClass` |
| `src/ui/fonts.ts` | The four fonts, loaded with `next/font/google` |

## Fonts

| Font | Used for |
| --- | --- |
| Atkinson Hyperlegible | Body text: designed for low-vision readers, letters are hard to confuse |
| Barlow Semi Condensed | Headings |
| Noto Sans Devanagari | Hindi |
| Noto Nastaliq Urdu | Urdu |

`next/font` downloads the fonts at build time and serves them from our own server, so the phone doesn't contact Google.

## Learn more

- https://tailwindcss.com/docs
- https://nextjs.org/docs/app/getting-started/fonts

## Questions you may be asked

**Q: Why Tailwind and not normal CSS files?**
A: It's quicker to keep a consistent look, and the final CSS only contains classes we really use, so it stays small.

**Q: How does the layout work for Urdu?**
A: Urdu pages set `dir="rtl"`. We use start/end classes like `ps-5` and `ms-2` instead of left/right, so the layout mirrors by itself.

**Q: Why Atkinson Hyperlegible?**
A: It was designed for people with low vision. Letters like I, l and 1 look different, which helps drivers reading quickly in sunlight.

**Q: Do the fonts slow the page down?**
A: `next/font` serves them from our own server, so there's no extra trip to Google, and the text shows at once with a fallback font while they load.
