import crypto from "crypto";

export const IDEMPOTENCY_KEY_MAX_LENGTH = 128;
export const IDEMPOTENCY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const ENCRYPTION_KEY_ENV = "PAYMENT_IDEMPOTENCY_ENCRYPTION_KEY";
const ENCRYPTION_VERSION = "v1";
const IV_BYTES = 12;
const KEY_BYTES = 32;

export function paymentConfirmationCookieName(orderId: string): string {
  return `payment_confirmation_${orderId}`;
}

export interface CreateOrderFingerprintInput {
  customerName: string;
  customerDiscord?: string;
  customerIGN?: string;
  customerNotes?: string;
  items: Array<{ productId: string; quantity: number }>;
  paymentMethod: string;
  currency?: string;
}

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateIdempotencyKey(value: string | null | undefined): string | null {
  if (value == null || value === "") return null;
  if (value.length > IDEMPOTENCY_KEY_MAX_LENGTH || !UUID_V4_PATTERN.test(value)) return null;
  return value;
}

function normalizeString(value: string | undefined): string {
  return value?.trim() || "";
}

export function fingerprintCreateOrderInput(input: CreateOrderFingerprintInput): string {
  const canonical = {
    customerName: normalizeString(input.customerName),
    customerDiscord: normalizeString(input.customerDiscord),
    customerIGN: normalizeString(input.customerIGN),
    customerNotes: normalizeString(input.customerNotes),
    items: input.items
      .map((item) => ({
        productId: normalizeString(item.productId),
        quantity: item.quantity,
      }))
      .sort((a, b) => (a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0)),
    paymentMethod: normalizeString(input.paymentMethod),
    currency: normalizeString(input.currency) || "IDR",
  };

  return crypto.createHash("sha256").update(JSON.stringify(canonical), "utf8").digest("hex");
}

function getEncryptionKey(): Buffer {
  const encoded = process.env[ENCRYPTION_KEY_ENV];
  if (!encoded) {
    throw new Error(`${ENCRYPTION_KEY_ENV} is required for payment-token replay`);
  }

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length % 4 !== 0) {
    throw new Error(`${ENCRYPTION_KEY_ENV} must be base64-encoded`);
  }

  const key = Buffer.from(encoded, "base64");
  if (key.toString("base64") !== encoded) {
    throw new Error(`${ENCRYPTION_KEY_ENV} must be base64-encoded`);
  }

  if (key.length !== KEY_BYTES) {
    throw new Error(`${ENCRYPTION_KEY_ENV} must decode to 32 bytes`);
  }
  return key;
}

function toBase64Url(value: Buffer): string {
  return value.toString("base64url");
}

function fromBase64Url(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

export function encryptPaymentToken(token: string): string {
  if (!token) throw new Error("Payment token is required for encryption");

  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    ENCRYPTION_VERSION,
    toBase64Url(iv),
    toBase64Url(authTag),
    toBase64Url(ciphertext),
  ].join(".");
}

export function decryptPaymentToken(payload: string): string {
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== ENCRYPTION_VERSION) {
    throw new Error("Invalid payment-token replay payload");
  }

  const [, encodedIv, encodedTag, encodedCiphertext] = parts;
  const iv = fromBase64Url(encodedIv);
  const authTag = fromBase64Url(encodedTag);
  const ciphertext = fromBase64Url(encodedCiphertext);

  if (iv.length !== IV_BYTES || authTag.length !== 16 || ciphertext.length === 0) {
    throw new Error("Invalid payment-token replay payload");
  }

  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("Unable to decrypt payment-token replay payload");
  }
}
