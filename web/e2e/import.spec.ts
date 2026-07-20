import { test, expect } from "@playwright/test";
import path from "path";

test.describe("Import", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /Try as guest/i }).click();
    await page.waitForURL("**/inventory**", { timeout: 15000 });
    await page.goto("/import");
  });

  test("upload TCGPlayer CSV shows cards in preview", async ({ page }) => {
    // Click TCGPlayer tab
    await page.getByRole("tab", { name: /TCGPlayer/i }).click();

    // Upload the fixture CSV
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(
      path.resolve(__dirname, "fixtures/sample-tcgplayer.csv")
    );

    // Should see cards in preview table
    await expect(page.getByText("Charizard")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Pikachu")).toBeVisible();
  });

  test("upload Collectr CSV shows cards in preview", async ({ page }) => {
    // Click Collectr tab
    await page.getByRole("tab", { name: /Collectr/i }).click();

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(
      path.resolve(__dirname, "fixtures/sample-collectr.csv")
    );

    await expect(page.getByText("Charizard")).toBeVisible({ timeout: 5000 });
  });

  test("empty file shows error or empty state", async ({ page }) => {
    await page.getByRole("tab", { name: /TCGPlayer/i }).click();

    // Create a temporary empty file by uploading an invalid CSV
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: "empty.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(""),
    });

    // Should show some indication that no cards were found
    // (either error toast, empty preview, or "no cards" message)
    await page.waitForTimeout(1000);
    const hasError = await page
      .getByText(/no cards|0 cards|empty|invalid/i)
      .isVisible()
      .catch(() => false);
    const hasNoRows = await page
      .locator("table tbody tr")
      .count()
      .then((c) => c === 0)
      .catch(() => true);

    expect(hasError || hasNoRows).toBe(true);
  });
});
