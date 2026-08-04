import { checkRateLimit } from "@/lib/middleware";

describe("rate limiting", () => {
  it("allows five attempts and blocks the sixth within a window", () => {
    const key = `test-confirm-${Date.now()}-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(key, 5, 60_000).allowed).toBe(true);
    }
    const blocked = checkRateLimit(key, 5, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });
});
