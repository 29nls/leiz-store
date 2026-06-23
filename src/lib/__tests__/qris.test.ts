import { qrisService } from "@/lib/qris";

describe("QRIS Service", () => {
  describe("isConfigured", () => {
    it("should return false when env vars are missing", () => {
      delete process.env.QRIS_MERCHANT_ID;
      delete process.env.QRIS_API_KEY;

      expect(qrisService.isConfigured()).toBe(false);
    });

    it("should return true when env vars are set", () => {
      process.env.QRIS_MERCHANT_ID = "M123";
      process.env.QRIS_API_KEY = "key123";

      expect(qrisService.isConfigured()).toBe(true);

      delete process.env.QRIS_MERCHANT_ID;
      delete process.env.QRIS_API_KEY;
    });
  });

  describe("generateQRISPayment", () => {
    it("should throw when not configured", async () => {
      delete process.env.QRIS_MERCHANT_ID;
      delete process.env.QRIS_API_KEY;

      await expect(
        qrisService.generateQRISPayment({
          amount: 150000,
          orderNumber: "LZ-20240101-ABC123",
        })
      ).rejects.toThrow("QRIS not configured");
    });

    it("should generate payment when configured", async () => {
      process.env.QRIS_MERCHANT_ID = "M123";
      process.env.QRIS_API_KEY = "key123";

      // Mock fetch to fail so it falls back to mock QR data
      global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));

      const payment = await qrisService.generateQRISPayment({
        amount: 150000,
        orderNumber: "LZ-20240101-ABC123",
      });

      expect(payment).toBeDefined();
      expect(payment.amount).toBe(150000);
      expect(payment.currency).toBe("IDR");
      expect(payment.status).toBe("PENDING");
      expect(payment.qrCode).toBeTruthy();
      expect(payment.expiresAt).toBeInstanceOf(Date);

      delete process.env.QRIS_MERCHANT_ID;
      delete process.env.QRIS_API_KEY;
    });
  });

  describe("verifyQRISPayment", () => {
    it("should throw when not configured", async () => {
      delete process.env.QRIS_MERCHANT_ID;
      delete process.env.QRIS_API_KEY;

      await expect(
        qrisService.verifyQRISPayment("txn-123")
      ).rejects.toThrow("QRIS not configured");
    });
  });

  describe("handleQRISCallback", () => {
    it("should parse successful callback", async () => {
      const result = await qrisService.handleQRISCallback({
        external_id: "LZ-20240101-ABC123",
        status: "SUCCEEDED",
        amount: 150000,
      });

      expect(result.orderNumber).toBe("LZ-20240101-ABC123");
      expect(result.status).toBe("SUCCESS");
      expect(result.amount).toBe(150000);
    });

    it("should parse failed callback", async () => {
      const result = await qrisService.handleQRISCallback({
        external_id: "LZ-20240101-ABC123",
        status: "FAILED",
        amount: 150000,
      });

      expect(result.status).toBe("FAILED");
    });
  });
});