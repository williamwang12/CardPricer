import { test, expect } from "@playwright/test";

test.describe("Inventory", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /Try as guest/i }).click();
    await page.waitForURL("**/inventory**", { timeout: 15000 });
  });

  test("shows empty state when no cards", async ({ page }) => {
    // A fresh guest account should have no cards
    const emptyState = page
      .getByText(/no cards|empty|get started|import/i)
      .first();
    await expect(emptyState).toBeVisible({ timeout: 5000 });
  });

  test("page loads with inventory heading or table structure", async ({
    page,
  }) => {
    // The inventory page should have some recognizable structure
    const heading = page.getByRole("heading", { name: /inventory/i }).or(
      page.getByText(/inventory/i).first()
    );
    await expect(heading).toBeVisible({ timeout: 5000 });
  });
});
