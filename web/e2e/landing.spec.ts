import { test, expect } from "@playwright/test";

test.describe("Landing page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("hero renders with headline, tagline, and CTA buttons", async ({
    page,
  }) => {
    await expect(
      page.getByRole("heading", {
        name: /fastest.*cheapest.*way.*to.*price.*cards/i,
      })
    ).toBeVisible();

    await expect(page.getByText(/Drop a CSV, get market prices/)).toBeVisible();

    await expect(
      page.getByRole("button", { name: /Get started with Google/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Try as guest/i })
    ).toBeVisible();
  });

  test("feature sections are visible", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /5 minutes from CSV to price tags/i })
    ).toBeVisible();

    await expect(
      page.getByRole("heading", { name: /Everything else you need/i })
    ).toBeVisible();

    await expect(
      page.getByRole("heading", { name: /Track every card like a stock/i })
    ).toBeVisible();
  });

  test("step cards are visible", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Import" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Track changes" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Export labels" })
    ).toBeVisible();
  });

  test("bottom CTA section is visible", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /Ready to price your next show/i })
    ).toBeVisible();
  });
});
