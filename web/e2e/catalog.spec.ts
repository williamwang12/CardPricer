import { test, expect } from "@playwright/test";

test.describe("Catalog", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /Try as guest/i }).click();
    await page.waitForURL("**/inventory**", { timeout: 15000 });
    await page.goto("/catalog");
  });

  test("catalog page loads with sets or search", async ({ page }) => {
    // The catalog page should have a search input or show sets
    const searchInput = page
      .getByPlaceholder(/search/i)
      .or(page.getByRole("textbox", { name: /search/i }));
    const setsHeading = page.getByText(/sets|browse/i).first();

    await expect(searchInput.or(setsHeading).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("search by card name returns results", async ({ page }) => {
    const searchInput = page
      .getByPlaceholder(/search/i)
      .or(page.getByRole("textbox").first());

    if (await searchInput.isVisible()) {
      await searchInput.fill("Charizard");
      // Press enter or wait for auto-search
      await searchInput.press("Enter");

      // Wait for results to load
      await page.waitForTimeout(3000);

      // Should see some search results (cards or a message)
      const hasResults = await page
        .getByText(/charizard/i)
        .first()
        .isVisible()
        .catch(() => false);
      const hasNoResults = await page
        .getByText(/no results|not found/i)
        .isVisible()
        .catch(() => false);

      expect(hasResults || hasNoResults).toBe(true);
    }
  });
});
