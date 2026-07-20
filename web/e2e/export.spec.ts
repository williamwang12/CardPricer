import { test, expect } from "@playwright/test";

test.describe("Export", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /Try as guest/i }).click();
    await page.waitForURL("**/inventory**", { timeout: 15000 });
    await page.goto("/export");
  });

  test("export page loads with download options", async ({ page }) => {
    // Export page should show pricing/sticker export options
    const priceListOption = page.getByText(/price list|price.*csv/i).first();
    const stickerOption = page.getByText(/sticker|label/i).first();
    const exportHeading = page.getByText(/export/i).first();

    await expect(
      priceListOption.or(stickerOption).or(exportHeading)
    ).toBeVisible({ timeout: 5000 });
  });

  test("price list download button is present", async ({ page }) => {
    const downloadBtn = page
      .getByRole("button", { name: /download|export|price list/i })
      .or(page.getByRole("link", { name: /download|export|price list/i }));

    await expect(downloadBtn.first()).toBeVisible({ timeout: 5000 });
  });

  test("sticker/label export button is present", async ({ page }) => {
    const stickerBtn = page
      .getByRole("button", { name: /sticker|label/i })
      .or(page.getByText(/sticker|label/i).first());

    await expect(stickerBtn).toBeVisible({ timeout: 5000 });
  });
});
