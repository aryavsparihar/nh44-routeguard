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
