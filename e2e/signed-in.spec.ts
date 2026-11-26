import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { expect, test, type Page } from "@playwright/test";

// Signed-in flows with the demo accounts from scripts/seed-demo.mts (Clerk
// test emails, code 424242). They write real rows, so they run only with
// E2E_DB=1, on one phone, one after another. Running the seed again removes
// what they wrote.
test.skip(!process.env.E2E_DB, "needs keys and the database: set E2E_DB=1");
test.describe.configure({ mode: "serial" });

const EMAIL = {
  admin: "routeguard.admin+clerk_test@example.com",
  agent: "routeguard.agent+clerk_test@example.com",
  driverVouched: "routeguard.driver1+clerk_test@example.com",
  driverNew: "routeguard.driver2+clerk_test@example.com",
  waiting: "routeguard.newdriver+clerk_test@example.com",
};

// On NH-44 at Banihal (zone 5), from data/incidents.csv.
const ON_ROAD = { latitude: 33.4379, longitude: 75.1955, accuracy: 20 };

async function signIn(page: Page, email: string) {
  await setupClerkTestingToken({ page });
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send me a code" }).click();
  await page.getByLabel("Code from the email").fill("424242");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"), { timeout: 20_000 });
}

async function fillReport(page: Page, hazard: string) {
  await page.goto("/report/new");
  await page.getByRole("radio", { name: hazard }).click();
  await page.getByRole("button", { name: "Use my location" }).click();
  await expect(page.getByText(/accurate to about/)).toBeVisible();
  await page.getByRole("checkbox").check();
}

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation(ON_ROAD);
});

test("a driver who isn't verified yet is asked to get verified before reporting", async ({ page }) => {
  await signIn(page, EMAIL.driverNew);
  await page.goto("/report/new");
  await expect(page.getByRole("heading", { name: "First, get verified" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open my Board" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send report" })).toHaveCount(0);
});

test("a vouched driver posts a report", async ({ page }) => {
  await signIn(page, EMAIL.driverVouched);
  await fillReport(page, "Other hazard");
  await page.getByRole("button", { name: "Send report" }).click();
  // A report of the same hazard nearby within the hour is merged into it.
  await expect(
    page.getByText(/Thank you\. Your report is saved\.|counted yours as a confirmation/),
  ).toBeVisible();
});

test("a report written with no signal waits on the phone and sends itself", async ({ page, context }) => {
  await signIn(page, EMAIL.driverVouched);
  await fillReport(page, "Accident");
  await context.setOffline(true);
  await page.getByRole("button", { name: "Send report" }).click();
  await expect(page.getByText("No signal. Your report is saved on this phone")).toBeVisible();

  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByText(/waiting reports? sent\./)).toBeVisible({ timeout: 20_000 });
});

test("the agent's board lists the demo trucks", async ({ page }) => {
  await signIn(page, EMAIL.agent);
  await page.goto("/board");
  await expect(page.getByText("JK02ZZ0003")).toBeVisible();
  await expect(page.getByText("JK02ZZ0004")).toBeVisible();
});

test("the admin posts an official update and the public sees it with its source", async ({ page, browser }) => {
  const title = `Demo update: one-way traffic at Banihal (e2e ${Date.now()})`;
  const ist = (d: Date) => new Date(d.getTime() + 5.5 * 3600_000).toISOString().slice(0, 16);

  await signIn(page, EMAIL.admin);
  await page.goto("/admin/updates");
  await page.locator("#title").fill(title);
  await page.locator("#source_name").fill("Demo source (e2e test)");
  await page.locator("#source_url").fill("https://example.com/e2e-advisory");
  await page.locator("#valid_until").fill(ist(new Date(Date.now() + 6 * 3600_000)));
  await page.getByRole("button", { name: "Post update" }).click();
  await expect(page.getByText("Posted.")).toBeVisible();

  const visitor = await browser.newPage();
  await expect(async () => {
    await visitor.goto("/");
    await expect(visitor.getByText(title)).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 90_000 });
  await expect(visitor.getByText("Demo source (e2e test)").first()).toBeVisible();
  await visitor.close();
});

// TCU approves every new account (20261126040000_tcu_approval.sql). The seed
// puts the "waiting" demo driver back to pending each time.
test("a new driver waits for TCU, TCU approves, and the driver's role works", async ({ page, browser }) => {
  await signIn(page, EMAIL.waiting);
  await page.goto("/me");
  await expect(page.getByRole("heading", { name: "Waiting for TCU" })).toBeVisible();
  await page.goto("/report/new");
  await expect(page.getByText(/wait for TCU to approve it/)).toBeVisible();

  const tcu = await browser.newPage();
  await signIn(tcu, EMAIL.admin);
  await tcu.goto("/admin/approvals");
  const card = tcu.getByRole("article").filter({ hasText: "Demo driver (waiting for TCU)" });
  await card.getByRole("button", { name: "Approve" }).click();
  await expect(card.getByText(/^Approved\./)).toBeVisible();
  await tcu.close();

  // /me asks Clerk for a fresh session token, so the role works at once.
  const freshToken = page.waitForResponse((res) => /\/sessions\/[^/]+\/tokens/.test(res.url()) && res.ok());
  await page.goto("/me");
  await expect(page.getByRole("link", { name: "Open your board" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Waiting for TCU" })).toHaveCount(0);
  await freshToken;
  await page.goto("/report/new");
  await expect(page.getByRole("heading", { name: "First, get verified" })).toBeVisible();
});

// Last, because it raises the demo driver to aadhaar_qr (the seed resets it).
// The picture is the demo QR signed with our test key, never a real card; the
// server needs FEATURE_AADHAAR_QR=true and AADHAAR_ALLOW_TEST_CERT=true.
test("a driver checks the demo Aadhaar QR from a picture and gets the badge", async ({ page }) => {
  test.skip(process.env.FEATURE_AADHAAR_QR !== "true", "set FEATURE_AADHAAR_QR=true to run the Aadhaar check");
  await signIn(page, EMAIL.driverNew);
  await page.goto("/me");
  const card = page.getByRole("region", { name: "Aadhaar QR check (optional)" });
  await expect(card).toBeVisible();
  await card.getByRole("checkbox").check();
  await card.getByLabel("Use a picture of the QR").setInputFiles("docs/demo/aadhaar-demo-qr.png");
  await expect(card.getByText("Demo check (test key)")).toBeVisible({ timeout: 15_000 });
  await expect(card.getByText(/Checked\. Your level is now/)).toBeVisible();
  await expect(page.getByText("Aadhaar checked").first()).toBeVisible();
  // Now verified, the same driver gets the report form.
  await page.goto("/report/new");
  await expect(page.getByRole("button", { name: "Send report" })).toBeVisible();
});

// The whole offline story in one run (BUILD_PROMPT section 13). Needs a
// production build: the service worker only registers there
// (src/ui/offline/OfflineStatus.tsx). Under `next dev` it is skipped.
test("offline: saved scores, advice on the phone, and a queued report sent exactly once", async ({ page, context }) => {
  const swActive = async () =>
    page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return false;
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 10_000)),
      ]);
      return !!reg?.active;
    });

  // 1. Load the map with signal, so the worker stores the page and the scores.
  await page.goto("/");
  test.skip(!(await swActive()), "no service worker here (run against `npm run build && npm start`)");
  await page.reload(); // now the worker controls the page and saves what it loads
  await expect(page.locator("main")).toContainText(/\d\.\d\d/);

  // 2. No signal, reload: the saved scores show, with how old they are.
  await context.setOffline(true);
  await page.reload();
  // The notice says it is a saved copy (with its time when the page knows it).
  await expect(page.getByText(/You.re offline\. Showing (data saved at|what this phone saved last)/)).toBeVisible();
  await expect(page.locator("main")).toContainText(/\d\.\d\d/);

  // 3. The advisor answers from the phone.
  await context.setOffline(false);
  // The advisor keeps the scores and road status it loaded for the offline answer.
  const loaded = Promise.all([
    page.waitForResponse((r) => new URL(r.url()).pathname === "/api/v1/risk"),
    page.waitForResponse((r) => new URL(r.url()).pathname === "/api/v1/road-status"),
  ]);
  await page.goto("/advisor");
  await loaded;
  await context.setOffline(true);
  await page.getByLabel("Days since picking").fill("12");
  await page.getByLabel("Load (tonnes)").fill("10");
  await page.getByRole("button", { name: "Get advice" }).click();
  await expect(page.getByText("No signal: worked out on this phone")).toBeVisible();
  await context.setOffline(false);

  // 4. As the vouched driver, queue a report with no signal.
  await signIn(page, EMAIL.driverVouched);
  const posts: number[] = [];
  page.on("response", (r) => {
    if (r.request().method() === "POST" && new URL(r.url()).pathname === "/api/v1/reports") posts.push(r.status());
  });
  await fillReport(page, "Other hazard");
  await context.setOffline(true);
  await page.getByRole("button", { name: "Send report" }).click();
  await expect(page.getByText("No signal. Your report is saved on this phone")).toBeVisible();
  expect(posts).toEqual([]); // nothing reached the server while offline

  // 5. Back online: it is sent once, and nothing is left waiting.
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByText(/waiting reports? sent\./)).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(2_000); // give a second send the chance to happen
  expect(posts.filter((s) => s < 300)).toHaveLength(1);
  await expect(page.getByText(/reports? waiting to send/)).toHaveCount(0);
});
