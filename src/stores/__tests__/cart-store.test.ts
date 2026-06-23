/**
 * @jest-environment jsdom
 */

import { useCartStore } from "@/stores/cart-store";
import type { CartItem } from "@/types";

// Reset store before each test
beforeEach(() => {
  useCartStore.setState({
    items: [],
    isOpen: false,
  });
});

const mockItem: Omit<CartItem, "id" | "quantity"> = {
  productId: "prod-1",
  name: "Test Product",
  slug: "test-product",
  price: 100000,
  image: "/test.jpg",
  unit: "pc",
  stock: 10,
};

describe("Cart Store", () => {
  describe("addItem", () => {
    it("should add a new item to the cart", () => {
      useCartStore.getState().addItem(mockItem);
      const items = useCartStore.getState().items;
      expect(items).toHaveLength(1);
      expect(items[0].productId).toBe("prod-1");
      expect(items[0].quantity).toBe(1);
    });

    it("should increment quantity for existing item", () => {
      useCartStore.getState().addItem(mockItem);
      useCartStore.getState().addItem(mockItem);
      const items = useCartStore.getState().items;
      expect(items).toHaveLength(1);
      expect(items[0].quantity).toBe(2);
    });

    it("should not exceed stock limit", () => {
      const lowStockItem = { ...mockItem, stock: 1 };
      useCartStore.getState().addItem(lowStockItem);
      useCartStore.getState().addItem(lowStockItem);
      const items = useCartStore.getState().items;
      expect(items[0].quantity).toBe(1);
    });

    it("should add multiple different items", () => {
      useCartStore.getState().addItem(mockItem);
      useCartStore.getState().addItem({ ...mockItem, productId: "prod-2", name: "Product 2" });
      const items = useCartStore.getState().items;
      expect(items).toHaveLength(2);
    });
  });

  describe("removeItem", () => {
    it("should remove an item from the cart", () => {
      useCartStore.getState().addItem(mockItem);
      useCartStore.getState().removeItem("prod-1");
      expect(useCartStore.getState().items).toHaveLength(0);
    });

    it("should not affect other items when removing", () => {
      useCartStore.getState().addItem(mockItem);
      useCartStore.getState().addItem({ ...mockItem, productId: "prod-2", name: "Product 2" });
      useCartStore.getState().removeItem("prod-1");
      const items = useCartStore.getState().items;
      expect(items).toHaveLength(1);
      expect(items[0].productId).toBe("prod-2");
    });
  });

  describe("updateQuantity", () => {
    it("should update quantity of an item", () => {
      useCartStore.getState().addItem(mockItem);
      useCartStore.getState().updateQuantity("prod-1", 5);
      expect(useCartStore.getState().items[0].quantity).toBe(5);
    });

    it("should remove item when quantity is 0", () => {
      useCartStore.getState().addItem(mockItem);
      useCartStore.getState().updateQuantity("prod-1", 0);
      expect(useCartStore.getState().items).toHaveLength(0);
    });

    it("should remove item when quantity is negative", () => {
      useCartStore.getState().addItem(mockItem);
      useCartStore.getState().updateQuantity("prod-1", -1);
      expect(useCartStore.getState().items).toHaveLength(0);
    });

    it("should cap quantity at stock limit", () => {
      useCartStore.getState().addItem(mockItem);
      useCartStore.getState().updateQuantity("prod-1", 20);
      expect(useCartStore.getState().items[0].quantity).toBe(10);
    });
  });

  describe("clearCart", () => {
    it("should clear all items", () => {
      useCartStore.getState().addItem(mockItem);
      useCartStore.getState().addItem({ ...mockItem, productId: "prod-2" });
      useCartStore.getState().clearCart();
      expect(useCartStore.getState().items).toHaveLength(0);
    });
  });

  describe("Calculations", () => {
    it("should calculate subtotal correctly", () => {
      useCartStore.getState().addItem(mockItem);
      useCartStore.getState().addItem({ ...mockItem, productId: "prod-2", price: 50000 });
      const subtotal = useCartStore.getState().getSubtotal();
      expect(subtotal).toBe(150000);
    });

    it("should calculate tax (11%) correctly", () => {
      useCartStore.getState().addItem(mockItem);
      const tax = useCartStore.getState().getTax();
      expect(tax).toBe(11000); // 11% of 100000
    });

    it("should calculate total correctly", () => {
      useCartStore.getState().addItem(mockItem);
      const total = useCartStore.getState().getTotal();
      expect(total).toBe(111000); // 100000 + 11000
    });

    it("should return 0 for empty cart", () => {
      expect(useCartStore.getState().getSubtotal()).toBe(0);
      expect(useCartStore.getState().getTax()).toBe(0);
      expect(useCartStore.getState().getTotal()).toBe(0);
      expect(useCartStore.getState().getItemCount()).toBe(0);
    });
  });

  describe("getItemCount", () => {
    it("should count total items correctly", () => {
      useCartStore.getState().addItem(mockItem);
      useCartStore.getState().addItem({ ...mockItem, productId: "prod-2" });
      expect(useCartStore.getState().getItemCount()).toBe(2);
    });

    it("should count quantities correctly", () => {
      useCartStore.getState().addItem(mockItem);
      useCartStore.getState().addItem(mockItem);
      expect(useCartStore.getState().getItemCount()).toBe(2);
    });
  });

  describe("setIsOpen", () => {
    it("should open and close the cart drawer", () => {
      useCartStore.getState().setIsOpen(true);
      expect(useCartStore.getState().isOpen).toBe(true);
      useCartStore.getState().setIsOpen(false);
      expect(useCartStore.getState().isOpen).toBe(false);
    });
  });
});
