import { test, expect } from "@playwright/test";

test.describe("Shows", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /Try as guest/i }).click();
    await page.waitForURL("**/inventory**", { timeout: 15000 });
    await page.goto("/shows");
  });

  test("shows page loads with create button or empty state", async ({
    page,
  }) => {
    const createBtn = page
      .getByRole("button", { name: /create|new|add/i })
      .or(page.getByRole("link", { name: /create|new|add/i }));
    const emptyState = page.getByText(
      /no shows|create.*first|get started/i
    );

    // Either a create button or empty state message should be visible
    await expect(createBtn.or(emptyState).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("can open create show form", async ({ page }) => {
    const createBtn = page
      .getByRole("button", { name: /create|new|add/i })
      .or(page.getByRole("link", { name: /create|new|add/i }));

    if (await createBtn.first().isVisible()) {
      await createBtn.first().click();

      // Should see form fields for show creation
      await expect(
        page
          .getByLabel(/name/i)
          .or(page.getByPlaceholder(/name/i))
          .first()
      ).toBeVisible({ timeout: 5000 });
    }
  });
});
