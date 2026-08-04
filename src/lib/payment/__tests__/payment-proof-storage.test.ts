import {
  PAYMENT_PROOF_BUCKET,
  PAYMENT_PROOF_MAX_BYTES,
  PAYMENT_PROOF_MIME_TYPES,
  hasValidPaymentProofSignature,
} from "../payment-proof-storage";

describe("payment proof storage", () => {
  it("uses a private bucket and bounded image policy", () => {
    expect(PAYMENT_PROOF_BUCKET).toBe("payment-proofs");
    expect(PAYMENT_PROOF_MAX_BYTES).toBe(5 * 1024 * 1024);
    expect(PAYMENT_PROOF_MIME_TYPES.has("image/png")).toBe(true);
    expect(PAYMENT_PROOF_MIME_TYPES.has("image/svg+xml")).toBe(false);
  });

  it("requires a matching image signature", () => {
    expect(hasValidPaymentProofSignature("image/png", Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
    expect(hasValidPaymentProofSignature("image/png", Uint8Array.from([0xff, 0xd8, 0xff]))).toBe(false);
    expect(hasValidPaymentProofSignature("image/webp", Uint8Array.from([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP")]))).toBe(true);
  });
});
