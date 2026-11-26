import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { expect, test, type Page } from "@playwright/test";

// The demo script's screens, opened as each demo account on a phone
// (docs/demo-script.md). Read-only: nothing is submitted. Each screen must
// load with no console errors and no failed /api/v1 call.
// Needs keys and the seeded demo accounts: E2E_DB=1.
test.skip(!process.env.E2E_DB, "needs keys and the database: set E2E_DB=1");
test.describe.configure({ mode: "serial", retries: 0 });
// Several screens per account, each given time for its API calls.
test.setTimeout(150_000);

const WALKS: { who: string; email: string | null; screens: string[] }[] = [
  { who: "signed out", email: null, screens: ["/", "/strip", "/advisor", "/backtest", "/privacy"] },
  {
    who: "TCU",
    email: "routeguard.admin+clerk_test@example.com",
    screens: ["/admin", "/admin/approvals", "/admin/updates", "/admin/reports", "/admin/road-status", "/admin/audit", "/board", "/report/new"],
  },
  { who: "agent", email: "routeguard.agent+clerk_test@example.com", screens: ["/board", "/", "/report/new", "/me"] },
  { who: "driver, vouched", email: "routeguard.driver1+clerk_test@example.com", screens: ["/board", "/report/new", "/me", "/"] },
  { who: "driver, not vouched", email: "routeguard.driver2+clerk_test@example.com", screens: ["/report/new", "/me", "/board"] },
  { who: "grower", email: "routeguard.grower+clerk_test@example.com", screens: ["/advisor", "/board", "/strip", "/me"] },
];

function watch(page: Page) {
  const problems: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") problems.push(`console: ${msg.text()}`);
  });
  page.on("pageerror", (err) => problems.push(`page error: ${err.message}`));
  page.on("response", (res) => {
    const url = new URL(res.url());
    if (url.pathname.startsWith("/api/v1/") && res.status() >= 400) problems.push(`${res.status()} ${url.pathname}`);
  });
  page.on("requestfailed", (req) => {
    const url = new URL(req.url());
    // A navigation away cancels requests still in flight; that isn't a failure.
    if (url.pathname.startsWith("/api/v1/") && req.failure()?.errorText !== "net::ERR_ABORTED") {
      problems.push(`failed ${url.pathname}: ${req.failure()?.errorText}`);
    }
  });
  return problems;
}

async function signIn(page: Page, email: string) {
  await setupClerkTestingToken({ page });
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send me a code" }).click();
  await page.getByLabel("Code from the email").fill("424242");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"), { timeout: 20_000 });
}

for (const walk of WALKS) {
  test(`demo walk as ${walk.who}: no console errors, no failed API calls`, async ({ page }) => {
    const problems = watch(page);
    if (walk.email) await signIn(page, walk.email);
    for (const screen of walk.screens) {
      await page.goto(screen);
      await page.waitForLoadState("load");
      // The board and the map keep a live connection open, so the network is
      // never idle; give the screen's API calls time to finish instead.
      await page.waitForTimeout(2500);
      await expect(page.getByText(/not an official/i).first()).toBeVisible();
      expect(problems, `on ${screen}`).toEqual([]);
    }
  });
}

test("the new screens: share on the strip, How this works, the backtest numbers", async ({ page }) => {
  const problems = watch(page);
  await page.goto("/strip");
  await expect(page.getByRole("button", { name: "Share this summary" })).toBeVisible();
  await page.goto("/");
  await page.getByRole("link", { name: /How this works/ }).click();
  await expect(page).toHaveURL(/\/backtest$/);
  await expect(page.getByRole("heading", { name: "How well the rules did on past closures" })).toBeVisible();
  await expect(page.getByText(/verified incidents from/)).toBeVisible();
  expect(problems).toEqual([]);
});
