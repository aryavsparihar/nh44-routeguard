import { loadEnvConfig } from "@next/env";
import { defineConfig, devices } from "@playwright/test";

// .env.local, for the signed-in tests' Clerk keys (never printed).
loadEnvConfig(process.cwd());

// Mobile end-to-end tests (BUILD_PROMPT section 18). Two phones: the Pixel 5
// profile and a 360 px wide screen, the narrowest we support.
//
//   npm run build && npm run e2e             starts `next start` on port 3000
//   E2E_BASE_URL=http://localhost:3100 npm run e2e   uses a running server
//
// Tests that need keys and the database (sign-in redirect, advisor answer)
// run only when E2E_DB=1, so
// CI, which has no database, runs the rest.
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL, locale: "en-IN", trace: "retain-on-failure" },
  projects: [
    { name: "pixel-5", testIgnore: /signed-in/, use: { ...devices["Pixel 5"] } },
    {
      name: "phone-360",
      testIgnore: /signed-in/,
      use: { browserName: "chromium", viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true },
    },
    // Signed-in flows write real rows: one phone is enough.
    { name: "signed-in", testMatch: /signed-in/, use: { ...devices["Pixel 5"] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npm run start", url: `${baseURL}/api/v1/health`, reuseExistingServer: true, timeout: 60_000 },
});
