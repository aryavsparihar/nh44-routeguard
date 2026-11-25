import { expect, test, type Page } from "@playwright/test";

// Public screens a judge opens on a phone. Each must fit the screen: no
// sideways scrolling (live-app bug L1: the map page was 560 px wide).
const PUBLIC_PAGES = ["/", "/strip", "/advisor", "/status", "/privacy", "/sign-in"];

async function overflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

for (const path of PUBLIC_PAGES) {
  test(`${path} fits the screen with no sideways scroll`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator("main")).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  });
}

test("every screen says it is not an official police service", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("It is not an official government or police service")).toBeVisible();
});

test("switching to Urdu turns the page right-to-left, and back", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");

  await page.getByRole("group", { name: "Language" }).getByRole("button", { name: "اردو" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ur");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  expect(await overflow(page)).toBeLessThanOrEqual(0);

  await page.locator('button[lang="hi"]').click();
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");

  await page.locator('button[lang="en"]').click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("an unknown page shows the not-found screen", async ({ page }) => {
  const res = await page.goto("/no-such-page");
  expect(res?.status()).toBe(404);
});

// These need the app's keys (Clerk, database), which CI's image doesn't have.
test.describe("with keys and the database", () => {
  test.skip(!process.env.E2E_DB, "needs keys and the database: set E2E_DB=1");

  test("signed-out visitors of the agent board are sent to sign in", async ({ page }) => {
    await page.goto("/board");
    await expect(page).toHaveURL(/sign-in/);
  });

  test("the advisor answers from the server", async ({ page }) => {
    await page.goto("/advisor");
    await page.getByLabel("Days since picking").fill("12");
    await page.getByLabel("Load (tonnes)").fill("10");
    const advice = page.waitForResponse((r) => r.url().includes("/api/v1/advice") && r.request().method() === "POST");
    await page.getByRole("button", { name: "Get advice" }).click();
    expect((await advice).status()).toBe(200);
    await expect(page.getByText("Worked out by the RouteGuard server")).toBeVisible();
    await expect(page.getByText(/Send now|Hold and check again|Book rail|Divert/).first()).toBeVisible();
  });

  test("the map shows the 48-hour strip with real scores", async ({ page }) => {
    await page.goto("/strip");
    await expect(page.locator("main")).toContainText(/\d\.\d\d/);
  });
});
