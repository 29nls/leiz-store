/**
 * Datetime formatting helpers
 *
 * Format tanggal & jam dalam locale id-ID dengan timezone Asia/Jakarta,
 * menggantikan penggunaan `toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })`
 * yang diduplikasi di beberapa tempat (Discord embeds, notifikasi, invoice).
 */

export const DEFAULT_TIME_ZONE = "Asia/Jakarta";

/** Format tanggal + jam, mis. "5 Agustus 2026 pukul 14.30" (id-ID, Asia/Jakarta). */
export function formatDateTime(
  date: Date | string | number,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: DEFAULT_TIME_ZONE,
    ...options,
  }).format(d);
}

/** Format tanggal singkat untuk tabel/listing, mis. "05/08/2026". */
export function formatShortDate(date: Date | string | number): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: DEFAULT_TIME_ZONE,
  }).format(d);
}
