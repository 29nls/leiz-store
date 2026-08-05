import { DEFAULT_TIME_ZONE, formatDateTime, formatShortDate } from "@/lib/datetime";

describe("datetime helpers", () => {
  // Waktu lokal Indonesia (UTC+7) — konsisten dengan timezone helper.
  const DATE = new Date("2026-08-05T14:30:00+07:00");

  describe("formatDateTime", () => {
    it("memformat tanggal lengkap dalam id-ID", () => {
      const result = formatDateTime(DATE);
      expect(result).toContain("Agustus");
      expect(result).toContain("2026");
    });

    it("menampilkan jam:menit", () => {
      expect(formatDateTime(DATE)).toMatch(/14[.:]30/);
    });

    it("menghormati timezone Asia/Jakarta", () => {
      expect(DEFAULT_TIME_ZONE).toBe("Asia/Jakarta");
      // 08:30 UTC = 15:30 WIB
      const utc = new Date("2026-08-05T08:30:00Z");
      expect(formatDateTime(utc)).toMatch(/15[.:]30/);
    });

    it("menerima string dan number", () => {
      expect(formatDateTime("2026-08-05T14:30:00+07:00")).toContain("Agustus");
      expect(formatDateTime(Date.parse("2026-08-05T14:30:00+07:00"))).toContain("Agustus");
    });

    it("mengembalikan '-' untuk tanggal tidak valid", () => {
      expect(formatDateTime("bukan-tanggal")).toBe("-");
      expect(formatDateTime("")).toBe("-");
    });

    it("mendukung override opsi", () => {
      const result = formatDateTime(DATE, { month: "2-digit", hour: undefined, minute: undefined });
      expect(result).toMatch(/08/);
    });
  });

  describe("formatShortDate", () => {
    it("memformat dd/mm/yyyy", () => {
      expect(formatShortDate(DATE)).toBe("05/08/2026");
    });

    it("mengembalikan '-' untuk tanggal tidak valid", () => {
      expect(formatShortDate("bukan-tanggal")).toBe("-");
    });
  });
});
