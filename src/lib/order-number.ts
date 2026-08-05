import crypto from "crypto";

/**
 * Storefront order numbers look like `LZ-20260805-ABC123`:
 * a date prefix (informational, reveals the order date — not secret) and a
 * 6-character base36 suffix.
 *
 * The suffix is generated with a CSPRNG (`crypto.randomInt`), which makes the
 * number random and unpredictable. This matters because the public `/track`
 * page uses the order number as a **bearer credential** — anyone who knows it
 * can read the order's status — so it must not be sequential or generated from
 * a predictable PRNG. (Previous versions used `Math.random()`, a non-CSPRNG,
 * and could even emit suffixes shorter than 6 characters.)
 *
 * See MED-1 in docs/security-audit-report.md.
 */
export function generateOrderNumber(date: Date = new Date()): string {
  const datePart = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(
    date.getDate()
  ).padStart(2, "0")}`;
  const randomPart = crypto
    .randomInt(0, Math.pow(36, 6))
    .toString(36)
    .toUpperCase()
    .padStart(6, "0");
  return `LZ-${datePart}-${randomPart}`;
}
