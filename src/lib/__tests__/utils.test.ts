import {
  formatPrice,
  formatDate,
  formatRelativeTime,
  slugify,
  generateOrderNumber,
  truncate,
  getInitials,
  debounce,
} from "@/lib/utils";

describe("Utility Functions", () => {
  describe("formatPrice", () => {
    it("should format IDR price", () => {
      const result = formatPrice(150000);
      expect(result).toContain("Rp");
      expect(result).toContain("150.000");
    });

    it("should handle zero", () => {
      const result = formatPrice(0);
      expect(result).toContain("Rp");
    });
  });

  describe("formatDate", () => {
    it("should format a date string", () => {
      const result = formatDate("2024-01-15");
      expect(result).toBeTruthy();
      expect(typeof result).toBe("string");
    });

    it("should format a Date object", () => {
      const result = formatDate(new Date("2024-06-21"));
      expect(result).toBeTruthy();
    });
  });

  describe("formatRelativeTime", () => {
    it("should return 'just now' for recent dates", () => {
      const now = new Date();
      const result = formatRelativeTime(now);
      expect(result).toBe("just now");
    });

    it("should return minutes ago", () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      const result = formatRelativeTime(fiveMinAgo);
      expect(result).toContain("m ago");
    });

    it("should return hours ago", () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const result = formatRelativeTime(twoHoursAgo);
      expect(result).toContain("h ago");
    });

    it("should return days ago", () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const result = formatRelativeTime(threeDaysAgo);
      expect(result).toContain("d ago");
    });
  });

  describe("slugify", () => {
    it("should convert text to slug", () => {
      expect(slugify("Hello World")).toBe("hello-world");
    });

    it("should handle special characters", () => {
      expect(slugify("Game Currency & Items!")).toBe("game-currency-items");
    });

    it("should handle multiple spaces", () => {
      expect(slugify("  Many   Spaces  ")).toBe("many-spaces");
    });
  });

  describe("generateOrderNumber", () => {
    it("should generate order number with LZ prefix", () => {
      const orderNumber = generateOrderNumber();
      expect(orderNumber).toMatch(/^LZ-\d{8}-[A-Z0-9]{6}$/);
    });

    it("should generate unique order numbers", () => {
      const nums = new Set(Array.from({ length: 100 }, () => generateOrderNumber()));
      // Should have at least some unique ones (collision unlikely but possible)
      expect(nums.size).toBeGreaterThan(90);
    });
  });

  describe("truncate", () => {
    it("should truncate long strings", () => {
      expect(truncate("Hello World", 5)).toBe("Hello...");
    });

    it("should not truncate short strings", () => {
      expect(truncate("Hi", 5)).toBe("Hi");
    });

    it("should handle exact length", () => {
      expect(truncate("Hello", 5)).toBe("Hello");
    });
  });

  describe("getInitials", () => {
    it("should return initials from name", () => {
      expect(getInitials("John Doe")).toBe("JD");
    });

    it("should handle single name", () => {
      expect(getInitials("John")).toBe("J");
    });

    it("should limit to 2 characters", () => {
      expect(getInitials("John Michael Doe")).toBe("JM");
    });
  });

  describe("debounce", () => {
    jest.useFakeTimers();

    it("should debounce function calls", () => {
      const fn = jest.fn();
      const debouncedFn = debounce(fn, 300);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(300);

      expect(fn).toHaveBeenCalledTimes(1);
    });

    afterEach(() => {
      jest.useRealTimers();
    });
  });
});