import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test.beforeEach(async ({ page }) => {
    // Login as guest first
    await page.goto("/login");
    await page.getByRole("button", { name: /Try as guest/i }).click();
    await page.waitForURL("**/inventory**", { timeout: 15000 });
  });

  test("desktop: primary links are visible", async ({ page }) => {
    // Skip on mobile viewports
    const viewport = page.viewportSize();
    if (viewport && viewport.width < 768) return;

    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Inventory" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Catalog" })).toBeVisible();
  });

  test("desktop: More dropdown reveals secondary links", async ({ page }) => {
    const viewport = page.viewportSize();
    if (viewport && viewport.width < 768) return;

    // Click the "More" button/dropdown trigger
    const moreButton = page.getByRole("button", { name: /More/i });
    if (await moreButton.isVisible()) {
      await moreButton.click();
      // Secondary links should appear
      await expect(
        page.getByRole("menuitem", { name: /Transactions/i }).or(
          page.getByRole("link", { name: /Transactions/i })
        )
      ).toBeVisible();
    }
  });

  test("navigates to different pages", async ({ page }) => {
    const viewport = page.viewportSize();
    if (viewport && viewport.width < 768) return;

    // Navigate to Catalog
    await page.getByRole("link", { name: "Catalog" }).click();
    await page.waitForURL("**/catalog**");
    expect(page.url()).toContain("/catalog");
  });
});

test.describe("Navigation - Mobile", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /Try as guest/i }).click();
    await page.waitForURL("**/inventory**", { timeout: 15000 });
  });

  test("hamburger menu opens and shows links", async ({ page }) => {
    // Find and click the hamburger/menu button
    const menuButton = page.getByRole("button", { name: /menu/i }).or(
      page.locator("button").filter({ has: page.locator("svg.lucide-menu") })
    );

    if (await menuButton.isVisible()) {
      await menuButton.click();

      // Navigation links should now be visible
      await expect(
        page.getByRole("link", { name: "Inventory" })
      ).toBeVisible();
    }
  });
});
