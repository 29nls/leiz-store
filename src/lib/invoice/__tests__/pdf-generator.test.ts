import { generateInvoicePdf } from "../pdf-generator";
import type { InvoiceData } from "../types";

const sampleData: InvoiceData = {
  invoiceNo: "INV/2026/07/ABC123",
  orderNumber: "LZ-20260705-XYZ789",
  customerName: "Budi Santoso",
  customerEmail: "budi@example.com",
  items: [
    { name: "Produk A", quantity: 2, price: 50000, total: 100000 },
    { name: "Produk B", quantity: 1, price: 75000, total: 75000 },
  ],
  subtotal: 175000,
  tax: 0,
  discount: 0,
  total: 175000,
  currency: "IDR",
  paymentMethod: "bank_transfer",
  createdAt: "2026-07-05T10:00:00Z",
  storeName: "LEIZ STORE",
};

describe("pdf-generator", () => {
  it("generates a PDF buffer", async () => {
    const buffer = await generateInvoicePdf(sampleData);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it("generates PDF with USD currency", async () => {
    const usdData = { ...sampleData, currency: "USD", total: 10.50 };
    const buffer = await generateInvoicePdf(usdData);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it("generates PDF with discount and tax", async () => {
    const withDiscount = {
      ...sampleData,
      discount: 25000,
      tax: 5000,
      subtotal: 200000,
      total: 180000,
    };
    const buffer = await generateInvoicePdf(withDiscount);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it("handles single item", async () => {
    const singleItem: InvoiceData = {
      ...sampleData,
      items: [{ name: "Produk C", quantity: 1, price: 100000, total: 100000 }],
      total: 100000,
    };
    const buffer = await generateInvoicePdf(singleItem);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(500);
  });

  it("handles many items without breaking", async () => {
    const manyItems = Array.from({ length: 20 }, (_, i) => ({
      name: `Produk ${i + 1}`,
      quantity: 1,
      price: 10000,
      total: 10000,
    }));
    const manyData = { ...sampleData, items: manyItems, total: 200000 };
    const buffer = await generateInvoicePdf(manyData);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(2000);
  });
});
