import { Atkinson_Hyperlegible, Barlow_Semi_Condensed, Noto_Nastaliq_Urdu, Noto_Sans_Devanagari } from "next/font/google";

// Fonts from the Round 2 style guide (docs/ux/data/tokens.json), plus one
// font per script for Hindi and Urdu (BUILD_PROMPT section 12). next/font
// downloads them at build time and serves them from our own site, so no
// request goes to Google when someone opens the app.
//
// The Hindi and Urdu fonts aren't preloaded: a browser downloads them only
// when a page in that language draws their letters.

export const bodyFont = Atkinson_Hyperlegible({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-atkinson",
  display: "swap",
});

export const headingFont = Barlow_Semi_Condensed({
  weight: ["600", "700"],
  subsets: ["latin"],
  variable: "--font-barlow",
  display: "swap",
});

export const devanagariFont = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  variable: "--font-devanagari",
  display: "swap",
  preload: false,
});

// Nastaliq is the usual Urdu script style. It is tall, so Urdu text gets a
// line height of 1.9 (globals.css). Naskh is the fallback if the Urdu
// reviewer finds it too tall on small phones (messages/REVIEW.md).
export const urduFont = Noto_Nastaliq_Urdu({
  weight: ["400", "700"],
  subsets: ["arabic"],
  variable: "--font-nastaliq",
  display: "swap",
  preload: false,
});

export const fontVariables = [bodyFont, headingFont, devanagariFont, urduFont].map((f) => f.variable).join(" ");
