import {
  formatPrice,
  convertCurrency,
  getDualPrice,
  parseCurrency,
  CURRENCIES,
} from "@/lib/currency";

describe("Currency Utilities", () => {
  describe("formatPrice", () => {
    it("should format IDR price without decimals", () => {
      const formatted = formatPrice(150000, "IDR");
      expect(formatted).toContain("Rp");
      expect(formatted).toContain("150.000");
    });

    it("should format USD price with decimals", () => {
      const formatted = formatPrice(9.99, "USD");
      expect(formatted).toContain("$");
      expect(formatted).toContain("9.99");
    });

    it("should default to IDR", () => {
      const formatted = formatPrice(100000);
      expect(formatted).toContain("Rp");
    });

    it("should handle zero", () => {
      expect(formatPrice(0, "IDR")).toContain("Rp");
      expect(formatPrice(0, "USD")).toContain("$");
    });

    it("should handle large numbers", () => {
      const formatted = formatPrice(10000000, "IDR");
      expect(formatted).toContain("Rp");
      expect(formatted).toContain("10.000.000");
    });
  });

  describe("convertCurrency", () => {
    it("should return same amount for same currency", () => {
      expect(convertCurrency(100000, "IDR", "IDR")).toBe(100000);
      expect(convertCurrency(10, "USD", "USD")).toBe(10);
    });

    it("should convert IDR to USD", () => {
      const usd = convertCurrency(158000, "IDR", "USD");
      expect(usd).toBeCloseTo(10, 0);
    });

    it("should convert USD to IDR", () => {
      const idr = convertCurrency(10, "USD", "IDR");
      expect(idr).toBeCloseTo(158000, -2);
    });

    it("should handle zero", () => {
      expect(convertCurrency(0, "IDR", "USD")).toBe(0);
    });
  });

  describe("getDualPrice", () => {
    it("should return primary IDR and secondary USD", () => {
      const dual = getDualPrice(150000, "IDR");
      expect(dual.primaryCurrency).toBe("IDR");
      expect(dual.secondaryCurrency).toBe("USD");
      expect(dual.primary).toContain("Rp");
      expect(dual.secondary).toContain("$");
    });

    it("should return primary USD and secondary IDR", () => {
      const dual = getDualPrice(150000, "USD");
      expect(dual.primaryCurrency).toBe("USD");
      expect(dual.secondaryCurrency).toBe("IDR");
      expect(dual.primary).toContain("$");
      expect(dual.secondary).toContain("Rp");
    });
  });

  describe("parseCurrency", () => {
    it("should parse formatted IDR string", () => {
      expect(parseCurrency("Rp 150.000")).toBe(150000);
    });

    it("should parse USD string", () => {
      expect(parseCurrency("$9.99")).toBe(9.99);
    });

    it("should parse plain number", () => {
      expect(parseCurrency("150000")).toBe(150000);
    });

    it("should return 0 for invalid input", () => {
      expect(parseCurrency("abc")).toBe(0);
    });

    it("should handle empty string", () => {
      expect(parseCurrency("")).toBe(0);
    });
  });

  describe("CURRENCIES", () => {
    it("should have IDR config", () => {
      expect(CURRENCIES.IDR).toBeDefined();
      expect(CURRENCIES.IDR.code).toBe("IDR");
      expect(CURRENCIES.IDR.decimals).toBe(0);
    });

    it("should have USD config", () => {
      expect(CURRENCIES.USD).toBeDefined();
      expect(CURRENCIES.USD.code).toBe("USD");
      expect(CURRENCIES.USD.decimals).toBe(2);
    });
  });
});
