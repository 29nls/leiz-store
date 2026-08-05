import {
  checkRateLimit,
  peekRateLimit,
  resetRateLimit,
  safeCheckRateLimit,
  safePeekRateLimit,
  LOGIN_RATE_LIMIT,
  ORDER_CREATE_RATE_LIMIT,
} from "@/lib/middleware";

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

describe("login & order throttling", () => {
  it("peek does not increment the bucket", () => {
    const key = `t-peek-${Date.now()}-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      expect(peekRateLimit(key, 3, 60_000).allowed).toBe(true);
    }
    // still allowed after 5 peeks against a 3-cap
    expect(peekRateLimit(key, 3, 60_000).allowed).toBe(true);
  });

  it("records failures and blocks once the account limit is reached", () => {
    const key = `t-acct-${Date.now()}-${Math.random()}`;
    // Simulate the login route recording one failed attempt per request.
    for (let i = 0; i < LOGIN_RATE_LIMIT.accountMax; i++) {
      safeCheckRateLimit(key, LOGIN_RATE_LIMIT.accountMax, LOGIN_RATE_LIMIT.windowMs);
    }
    expect(
      safePeekRateLimit(key, LOGIN_RATE_LIMIT.accountMax, LOGIN_RATE_LIMIT.windowMs).allowed
    ).toBe(false);
  });

  it("lockout expires and restores access", async () => {
    const key = `t-exp-${Date.now()}-${Math.random()}`;
    const windowMs = 30;
    for (let i = 0; i < 5; i++) {
      safeCheckRateLimit(key, 5, windowMs);
    }
    expect(safePeekRateLimit(key, 5, windowMs).allowed).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, windowMs + 20));
    expect(safePeekRateLimit(key, 5, windowMs).allowed).toBe(true);
  });

  it("resetRateLimit clears a bucket (successful login)", () => {
    const key = `t-rst-${Date.now()}-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      safeCheckRateLimit(key, 5, 60_000);
    }
    expect(safePeekRateLimit(key, 5, 60_000).allowed).toBe(false);
    resetRateLimit(key);
    expect(safePeekRateLimit(key, 5, 60_000).allowed).toBe(true);
  });

  it("safe wrappers always return a usable result (fail-open)", () => {
    // Nonsensical arguments must never throw through the safe wrappers.
    const key = `t-safe-${Date.now()}-${Math.random()}`;
    expect(safeCheckRateLimit(key, 0, -1)).toHaveProperty("allowed");
    expect(safePeekRateLimit(key, 0, -1)).toHaveProperty("allowed");
  });

  it("order creation cap allows legitimate volume and blocks flooding", () => {
    const key = `t-order-${Date.now()}-${Math.random()}`;
    for (let i = 0; i < ORDER_CREATE_RATE_LIMIT.max; i++) {
      expect(checkRateLimit(key, ORDER_CREATE_RATE_LIMIT.max, ORDER_CREATE_RATE_LIMIT.windowMs).allowed).toBe(true);
    }
    expect(checkRateLimit(key, ORDER_CREATE_RATE_LIMIT.max, ORDER_CREATE_RATE_LIMIT.windowMs).allowed).toBe(false);
  });
});
