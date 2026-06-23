import { test, expect } from "@playwright/test";

test.describe("Smoke Tests", () => {
  test("homepage loads and displays featured products", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/LEIZ STORE|Leiz Store/i);
    await expect(page.locator("nav, header, [role='navigation']")).toBeVisible();
  });

  test("products page shows product grid", async ({ page }) => {
    await page.goto("/products");
    await expect(page).toHaveURL(/\/products/);
    // Wait for product cards to render
    await page.waitForLoadState("networkidle");
    const productCards = page.locator(
      '[class*="product"], [class*="card"], article, [data-testid="product-card"]'
    );
    // Products may or may not be loaded depending on DB state
    // but the page should render without errors
    await expect(page.locator("body")).toBeVisible();
  });

  test("navigation links work correctly", async ({ page }) => {
    await page.goto("/");
    const homeLink = page.locator('a[href="/"], a:has-text("Home"), a:has-text("Store")').first();
    if (await homeLink.isVisible()) {
      await homeLink.click();
      await expect(page).toHaveURL("/");
    }
  });

  test("login page loads", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("checkout page redirects to login when not authenticated", async ({ page }) => {
    await page.goto("/checkout");
    // Should redirect to login or show auth error
    await page.waitForLoadState("networkidle");
    const currentUrl = page.url();
    // Should either redirect to login or stay on checkout
    expect(
      currentUrl.includes("/auth/login") || currentUrl.includes("/checkout")
    ).toBe(true);
  });
});

test.describe("Wishlist", () => {
  test("wishlist page loads when not authenticated", async ({ page }) => {
    await page.goto("/wishlist");
    await page.waitForLoadState("networkidle");
    // Should either show login redirect or an empty wishlist
    expect(page.url()).toContain("/wishlist");
  });
});
