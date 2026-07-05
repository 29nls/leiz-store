import { buildInvoiceEmailHtml } from "../email-sender";
import type { InvoiceData } from "../types";

const sampleData: InvoiceData = {
  invoiceNo: "INV/2026/07/ABC123",
  orderNumber: "LZ-20260705-XYZ789",
  customerName: "Budi Santoso",
  customerEmail: "budi@example.com",
  items: [
    { name: "Produk A", quantity: 2, price: 50000, total: 100000 },
  ],
  subtotal: 100000,
  tax: 0,
  discount: 0,
  total: 100000,
  currency: "IDR",
  paymentMethod: "bank_transfer",
  createdAt: "2026-07-05T10:00:00Z",
  storeName: "LEIZ STORE",
};

describe("email-sender", () => {
  describe("buildInvoiceEmailHtml", () => {
    it("includes invoice number", () => {
      const html = buildInvoiceEmailHtml(sampleData);
      expect(html).toContain("INV/2026/07/ABC123");
    });

    it("includes customer name", () => {
      const html = buildInvoiceEmailHtml(sampleData);
      expect(html).toContain("Budi Santoso");
    });

    it("includes order number", () => {
      const html = buildInvoiceEmailHtml(sampleData);
      expect(html).toContain("LZ-20260705-XYZ789");
    });

    it("includes product items", () => {
      const html = buildInvoiceEmailHtml(sampleData);
      expect(html).toContain("Produk A");
      expect(html).toContain("Rp100.000");
    });

    it("includes total amount", () => {
      const html = buildInvoiceEmailHtml(sampleData);
      expect(html).toContain("Rp100.000");
    });

    it("shows discount when present", () => {
      const withDiscount = { ...sampleData, discount: 25000, total: 75000 };
      const html = buildInvoiceEmailHtml(withDiscount);
      expect(html).toContain("25.000");
    });

    it("shows tax when present", () => {
      const withTax = { ...sampleData, tax: 10000, total: 110000 };
      const html = buildInvoiceEmailHtml(withTax);
      expect(html).toContain("10.000");
    });

    it("handles USD currency", () => {
      const usd = { ...sampleData, currency: "USD", total: 10.50 };
      const html = buildInvoiceEmailHtml(usd);
      expect(html).toContain("$10.50");
    });

    it("handles multiple items", () => {
      const multi = {
        ...sampleData,
        items: [
          { name: "Item A", quantity: 1, price: 50000, total: 50000 },
          { name: "Item B", quantity: 3, price: 25000, total: 75000 },
        ],
        total: 125000,
      };
      const html = buildInvoiceEmailHtml(multi);
      expect(html).toContain("Item A");
      expect(html).toContain("Item B");
      expect(html).toContain("Rp125.000");
    });

    it("returns a non-empty HTML string", () => {
      const html = buildInvoiceEmailHtml(sampleData);
      expect(html.length).toBeGreaterThan(200);
      expect(html).toContain("<!DOCTYPE html>");
    });
  });
});
