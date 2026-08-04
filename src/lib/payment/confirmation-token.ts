import crypto from "crypto";

export const PAYMENT_TOKEN_BYTES = 32;
export const PAYMENT_TOKEN_LENGTH = 43;

export function generatePaymentToken(): string {
  return crypto.randomBytes(PAYMENT_TOKEN_BYTES).toString("base64url");
}

export function hashPaymentToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

export function isValidPaymentToken(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function verifyPaymentToken(token: unknown, expectedHash: unknown): boolean {
  if (!isValidPaymentToken(token) || typeof expectedHash !== "string" || !/^[a-f0-9]{64}$/.test(expectedHash)) {
    return false;
  }

  const actual = Buffer.from(hashPaymentToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
