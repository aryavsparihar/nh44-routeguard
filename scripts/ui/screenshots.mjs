// Phone screenshots for the README (BUILD_PROMPT section 20, item 3).
//
//   node scripts/ui/screenshots.mjs [base-url]
//
// Pixel 5 size, English, Hindi and Urdu, saved to docs/screenshots/ as JPEG.
// macOS (Metal). Run against `npm start` with the database, after `node scripts/seed-demo.mts`.
import { chromium, devices } from "@playwright/test";
import fs from "node:fs";

const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const PAGES = { home: "/", strip: "/strip", advisor: "/advisor" };
const out = "docs/screenshots";
fs.mkdirSync(out, { recursive: true });

// The GPU renderer: headless Chromium's software WebGL leaves a blank band
// across the top of the map at the Pixel 5's 2.75 pixel ratio.
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=metal"] });
for (const lang of ["en", "hi", "ur"]) {
  const context = await browser.newContext({ ...devices["Pixel 5"] });
  await context.addCookies([{ name: "rg_lang", value: lang, url: base }]);
  const page = await context.newPage();
  for (const [name, path] of Object.entries(PAGES)) {
    await page.goto(base + path, { waitUntil: "networkidle" });
    await page.waitForTimeout(3000); // map tiles and fonts
    await page.screenshot({ path: `${out}/${lang}-${name}.jpg`, type: "jpeg", quality: 70 });
    console.log(`${out}/${lang}-${name}.jpg`);
  }
  await context.close();
}
await browser.close();
