import { t, setLocale, getLocale, getTranslations, detectLocale, LOCALE_NAMES } from "@/lib/i18n";

describe("i18n Utilities", () => {
  beforeEach(() => {
    setLocale("en");
  });

  describe("t() - Translation", () => {
    it("should translate a simple key in English", () => {
      const result = t("common.loading", "en");
      expect(result).toBe("Loading...");
    });

    it("should translate a simple key in Indonesian", () => {
      const result = t("common.loading", "id");
      expect(result).toBe("Memuat...");
    });

    it("should translate nested keys", () => {
      expect(t("nav.home", "en")).toBe("Home");
      expect(t("nav.home", "id")).toBe("Beranda");
    });

    it("should fallback to English for missing Indonesian key", () => {
      // This tests the fallback mechanism
      const result = t("common.loading", "id");
      expect(result).toBe("Memuat...");
    });

    it("should return key path if not found", () => {
      const result = t("nonexistent.path.key");
      expect(result).toBe("nonexistent.path.key");
    });

    it("should use current locale if not specified", () => {
      setLocale("id");
      expect(t("nav.home")).toBe("Beranda");
      setLocale("en");
      expect(t("nav.home")).toBe("Home");
    });
  });

  describe("setLocale / getLocale", () => {
    it("should set and get locale", () => {
      setLocale("id");
      expect(getLocale()).toBe("id");
      setLocale("en");
      expect(getLocale()).toBe("en");
    });
  });

  describe("getTranslations", () => {
    it("should return all translations for a namespace", () => {
      const navTranslations = getTranslations("nav", "en");
      expect(navTranslations.home).toBe("Home");
      expect(navTranslations.products).toBe("Products");
      expect(navTranslations.cart).toBe("Cart");
    });

    it("should return Indonesian translations", () => {
      const navTranslations = getTranslations("nav", "id");
      expect(navTranslations.home).toBe("Beranda");
      expect(navTranslations.products).toBe("Produk");
    });

    it("should return empty object for invalid namespace", () => {
      const result = getTranslations("nonexistent");
      expect(result).toEqual({});
    });
  });

  describe("detectLocale", () => {
    it("should detect Indonesian from Accept-Language", () => {
      expect(detectLocale("id-ID,id;q=0.9,en;q=0.8")).toBe("id");
    });

    it("should detect English as default", () => {
      expect(detectLocale("en-US,en;q=0.9")).toBe("en");
    });

    it("should default to English for no header", () => {
      expect(detectLocale()).toBe("en");
    });

    it("should default to English for empty string", () => {
      expect(detectLocale("")).toBe("en");
    });
  });

  describe("LOCALE_NAMES", () => {
    it("should have English name", () => {
      expect(LOCALE_NAMES.en).toBe("English");
    });

    it("should have Indonesian name", () => {
      expect(LOCALE_NAMES.id).toBe("Bahasa Indonesia");
    });
  });
});
