import { generateOrderNumber } from "@/lib/order-number";

describe("generateOrderNumber", () => {
  it("produces an LZ-{date}-{6 alphanumeric} order number", () => {
    const orderNumber = generateOrderNumber(new Date(2026, 7, 5));
    expect(orderNumber).toMatch(/^LZ-20260805-[A-Z0-9]{6}$/);
  });

  it("always emits a full 6-character suffix", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateOrderNumber()).toMatch(/^LZ-\d{8}-[A-Z0-9]{6}$/);
    }
  });

  it("generates distinct suffixes", () => {
    const seen = new Set(Array.from({ length: 500 }, () => generateOrderNumber()));
    expect(seen.size).toBeGreaterThan(450);
  });
});
