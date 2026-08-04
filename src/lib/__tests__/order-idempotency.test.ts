import {
  IDEMPOTENCY_KEY_MAX_LENGTH,
  decryptPaymentToken,
  encryptPaymentToken,
  fingerprintCreateOrderInput,
  validateIdempotencyKey,
} from "@/lib/order-idempotency";

describe("order idempotency helpers", () => {
  const encryptionKey = Buffer.alloc(32, 7).toString("base64");

  afterEach(() => {
    delete process.env.PAYMENT_IDEMPOTENCY_ENCRYPTION_KEY;
  });

  it("accepts a UUID v4 idempotency key and rejects malformed or oversized values", () => {
    const key = "550e8400-e29b-41d4-a716-446655440000";

    expect(validateIdempotencyKey(key)).toBe(key);
    expect(validateIdempotencyKey(undefined)).toBeNull();
    expect(validateIdempotencyKey("not-a-key")).toBeNull();
    expect(validateIdempotencyKey("x".repeat(IDEMPOTENCY_KEY_MAX_LENGTH + 1))).toBeNull();
  });

  it("fingerprints semantically equivalent item ordering identically", () => {
    const base = {
      customerName: " Ada ",
      customerDiscord: "ada#1234",
      customerIGN: "ada",
      customerNotes: "gift",
      paymentMethod: "QRIS",
      currency: "IDR",
      items: [
        { productId: "p-2", quantity: 1 },
        { productId: "p-1", quantity: 2 },
      ],
    };
    const reordered = {
      ...base,
      customerName: "Ada",
      items: [base.items[1], base.items[0]],
    };

    expect(fingerprintCreateOrderInput(base)).toBe(fingerprintCreateOrderInput(reordered));
  });

  it("produces a stable SHA-256 fingerprint for the same input", () => {
    const input = {
      customerName: "Ada",
      items: [{ productId: "p-1", quantity: 2 }],
      paymentMethod: "QRIS",
      currency: "IDR",
    };

    expect(fingerprintCreateOrderInput(input)).toMatch(/^[a-f0-9]{64}$/);
    expect(fingerprintCreateOrderInput(input)).toBe(fingerprintCreateOrderInput(input));
  });

  it("round-trips the encrypted token and rejects tampering", () => {
    process.env.PAYMENT_IDEMPOTENCY_ENCRYPTION_KEY = encryptionKey;

    const encrypted = encryptPaymentToken("secret-token");

    expect(encrypted).toMatch(/^v1\.[^.]+\.[^.]+\.[^.]+$/);
    expect(decryptPaymentToken(encrypted)).toBe("secret-token");
    expect(() => decryptPaymentToken(`${encrypted.slice(0, -2)}aa`)).toThrow();
  });

  it("uses a fresh IV for each encrypted payload", () => {
    process.env.PAYMENT_IDEMPOTENCY_ENCRYPTION_KEY = encryptionKey;

    const first = encryptPaymentToken("secret-token");
    const second = encryptPaymentToken("secret-token");

    expect(first).not.toBe(second);
    expect(decryptPaymentToken(first)).toBe("secret-token");
    expect(decryptPaymentToken(second)).toBe("secret-token");
  });

  it("fails closed when the encryption key is absent or malformed", () => {
    expect(() => encryptPaymentToken("secret-token")).toThrow();
    expect(() => decryptPaymentToken("v1.a.b.c")).toThrow();

    process.env.PAYMENT_IDEMPOTENCY_ENCRYPTION_KEY = "not-base64";
    expect(() => encryptPaymentToken("secret-token")).toThrow();

    process.env.PAYMENT_IDEMPOTENCY_ENCRYPTION_KEY = Buffer.alloc(31, 7).toString("base64");
    expect(() => encryptPaymentToken("secret-token")).toThrow();
  });
});
