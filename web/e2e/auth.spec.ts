import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("guest login redirects to /inventory", async ({ page }) => {
    await page.goto("/login");

    // Click "Try as guest" button
    await page.getByRole("button", { name: /Try as guest/i }).click();

    // Should redirect to inventory after guest login
    await page.waitForURL("**/inventory**", { timeout: 15000 });
    expect(page.url()).toContain("/inventory");
  });

  test("unauthenticated /inventory redirects to /login", async ({ page }) => {
    // Try to access protected route directly without auth
    await page.goto("/inventory");

    // Should redirect to login page
    await page.waitForURL("**/login**", { timeout: 10000 });
    expect(page.url()).toContain("/login");
  });
});
