import { test, expect } from "@playwright/test";

const cartItem = {
  id: "cart-item-e2e",
  productId: "product-e2e",
  name: "E2E Product",
  slug: "e2e-product",
  price: 100000,
  image: "/placeholder.png",
  unit: "pc",
  quantity: 1,
  stock: 10,
};

test.describe("Checkout payment token transport", () => {
  test("submits a keyed checkout and carries the payment token on the payment URL", async ({ page }) => {
    await page.addInitScript((item) => {
      window.localStorage.setItem("leiz-cart", JSON.stringify({
        state: { items: [item], isOpen: false },
        version: 0,
      }));
    }, cartItem);

    let submittedKey: string | undefined;
    await page.route("**/api/orders", async (route) => {
      const request = route.request();
      submittedKey = request.headers()["idempotency-key"];
      expect(submittedKey).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );

      await route.fulfill({
        status: 201,
        contentType: "application/json",
        headers: {
          "Set-Cookie": "payment_confirmation_order-e2e=token; HttpOnly; Path=/api/orders/order-e2e/confirm; SameSite=Lax",
        },
        body: JSON.stringify({
          success: true,
          data: {
            id: "order-e2e",
            orderNumber: "LZ-E2E",
            status: "PENDING_PAYMENT",
            paymentConfirmationToken: "e2e-token-value",
          },
        }),
      });
    });

    await page.goto("/checkout");
    await page.getByLabel("Name *").fill("E2E Customer");
    await page.getByLabel("Discord User ID *").fill("123456789012345678");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Place Order & Pay" }).click();

    await expect(page).toHaveURL(/\/payment\/order-e2e\?token=e2e-token-value$/);
    // The order-scoped bearer token rides on the payment URL so confirmation
    // works cross-device (no HttpOnly cookie on the new device).
    expect(new URL(page.url()).searchParams.get("token")).toBe("e2e-token-value");
    expect(submittedKey).toBeTruthy();
  });
});
