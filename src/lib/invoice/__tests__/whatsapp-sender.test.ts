import { buildWhatsAppMessage } from "../whatsapp-sender";

describe("whatsapp-sender", () => {
  describe("buildWhatsAppMessage", () => {
    const data = {
      invoiceNo: "INV/2026/07/ABC123",
      orderNumber: "LZ-20260705-XYZ789",
      total: 175000,
      currency: "IDR" as const,
    };

    it("includes invoice number", () => {
      const msg = buildWhatsAppMessage(data);
      expect(msg).toContain("INV/2026/07/ABC123");
    });

    it("includes total in IDR format", () => {
      const msg = buildWhatsAppMessage(data);
      expect(msg).toContain("Rp175.000");
    });

    it("includes order number", () => {
      const msg = buildWhatsAppMessage(data);
      expect(msg).toContain("LZ-20260705-XYZ789");
    });

    it("handles USD currency", () => {
      const usdData = { ...data, currency: "USD" as const, total: 10.50 };
      const msg = buildWhatsAppMessage(usdData);
      expect(msg).toContain("$10.50");
    });

    it("returns a non-empty message", () => {
      const msg = buildWhatsAppMessage(data);
      expect(msg.length).toBeGreaterThan(50);
    });
  });
});
