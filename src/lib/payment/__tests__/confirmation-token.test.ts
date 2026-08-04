import {
  generatePaymentToken,
  hashPaymentToken,
  isValidPaymentToken,
} from "../confirmation-token";

describe("payment confirmation tokens", () => {
  it("generates a cryptographically strong token accepted by the validator", () => {
    const token = generatePaymentToken();

    expect(token).toHaveLength(43);
    expect(isValidPaymentToken(token)).toBe(true);
  });

  it("generates different tokens for separate orders", () => {
    expect(generatePaymentToken()).not.toBe(generatePaymentToken());
  });

  it("hashes deterministically without returning the raw token", () => {
    const token = generatePaymentToken();
    const hash = hashPaymentToken(token);

    expect(hash).toHaveLength(64);
    expect(hash).toBe(hashPaymentToken(token));
    expect(hash).not.toBe(token);
    expect(isValidPaymentToken("too-short")).toBe(false);
  });
});
