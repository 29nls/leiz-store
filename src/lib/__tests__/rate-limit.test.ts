/**
 * Tests for the Redis/KV-backed rate limiter (src/lib/rate-limit.ts).
 *
 * Covers: in-memory fallback behavior, Redis/KV REST store interaction
 * (INCR/EXPIRE/PTTL via mocked fetch), fail-open wrappers, store selection
 * from env, and the admin route guard (enforceAdminRateLimit).
 */

import {
  checkRateLimit,
  peekRateLimit,
  resetRateLimit,
  safeCheckRateLimit,
  safePeekRateLimit,
  ADMIN_RATE_LIMIT,
  enforceAdminRateLimit,
  redisRateLimitConfigured,
} from "@/lib/rate-limit";

function uniqueKey(prefix: string): string {
  return `${prefix}:${Date.now()}-${Math.random()}`;
}

// jsdom does not provide the global Request — use a plain object exposing the
// header accessor enforceAdminRateLimit needs (mirrors how route tests build
// request-like objects).
function requestWithIp(ip: string): Request {
  return {
    headers: {
      get: (name: string) => (name === "x-forwarded-for" ? ip : null),
    },
  } as unknown as Request;
}

function kvResponse(result: unknown): { ok: boolean; json: () => Promise<{ result: unknown }> } {
  return { ok: true, json: async () => ({ result }) };
}

const fetchMock = global.fetch as jest.Mock;

describe("store selection", () => {
  const OLD_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...OLD_ENV };
  });

  it("reports not configured without KV/Upstash env vars", () => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    expect(redisRateLimitConfigured()).toBe(false);
  });

  it("is configured when Vercel KV vars are present", () => {
    process.env.KV_REST_API_URL = "https://example.kv.vercel-storage.com";
    process.env.KV_REST_API_TOKEN = "token";
    expect(redisRateLimitConfigured()).toBe(true);
  });

  it("is configured when Upstash vars are present", () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    expect(redisRateLimitConfigured()).toBe(true);
  });
});

describe("rate limiting (in-memory fallback)", () => {
  const OLD_ENV = { ...process.env };

  beforeEach(() => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = { ...OLD_ENV };
  });

  it("allows five attempts and blocks the sixth within a window", async () => {
    const key = uniqueKey("t-mem");
    for (let i = 0; i < 5; i++) {
      expect((await checkRateLimit(key, 5, 60_000)).allowed).toBe(true);
    }
    const blocked = await checkRateLimit(key, 5, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("peek does not increment the bucket", async () => {
    const key = uniqueKey("t-peek");
    for (let i = 0; i < 5; i++) {
      expect((await peekRateLimit(key, 3, 60_000)).allowed).toBe(true);
    }
    // still allowed after 5 peeks against a 3-cap
    expect((await peekRateLimit(key, 3, 60_000)).allowed).toBe(true);
  });

  it("lockout expires and restores access", async () => {
    const key = uniqueKey("t-exp");
    const windowMs = 30;
    for (let i = 0; i < 5; i++) {
      await safeCheckRateLimit(key, 5, windowMs);
    }
    expect((await safePeekRateLimit(key, 5, windowMs)).allowed).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, windowMs + 20));
    expect((await safePeekRateLimit(key, 5, windowMs)).allowed).toBe(true);
  });

  it("resetRateLimit clears a bucket (successful login)", async () => {
    const key = uniqueKey("t-rst");
    for (let i = 0; i < 5; i++) {
      await safeCheckRateLimit(key, 5, 60_000);
    }
    expect((await safePeekRateLimit(key, 5, 60_000)).allowed).toBe(false);
    await resetRateLimit(key);
    expect((await safePeekRateLimit(key, 5, 60_000)).allowed).toBe(true);
  });

  it("safe wrappers always return a usable result (fail-open)", async () => {
    const key = uniqueKey("t-safe");
    expect(await safeCheckRateLimit(key, 0, -1)).toHaveProperty("allowed");
    expect(await safePeekRateLimit(key, 0, -1)).toHaveProperty("allowed");
  });

  it("does not hit the network when no Redis is configured", async () => {
    const key = uniqueKey("t-nonet");
    await checkRateLimit(key, 5, 60_000);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("Redis/KV REST store", () => {
  const OLD_ENV = { ...process.env };

  beforeEach(() => {
    process.env.KV_REST_API_URL = "https://example.kv.vercel-storage.com";
    process.env.KV_REST_API_TOKEN = "test-token";
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...OLD_ENV };
  });

  it("anchors the window with INCR + EXPIRE and reports PTTL-based reset", async () => {
    const key = uniqueKey("t-redis");
    fetchMock
      .mockResolvedValueOnce(kvResponse(1)) // INCR
      .mockResolvedValueOnce(kvResponse(1)) // EXPIRE (first hit)
      .mockResolvedValueOnce(kvResponse(60_000)); // PTTL

    const result = await checkRateLimit(key, 5, 60_000);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://example.kv.vercel-storage.com/INCR",
      expect.objectContaining({ method: "POST" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://example.kv.vercel-storage.com/EXPIRE",
      expect.objectContaining({ body: JSON.stringify([key, 60]) })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://example.kv.vercel-storage.com/PTTL",
      expect.anything()
    );
  });

  it("blocks once the count exceeds the cap without re-EXPIREing", async () => {
    const key = uniqueKey("t-redis-block");
    fetchMock
      .mockResolvedValueOnce(kvResponse(6)) // INCR → 6 > max 5
      .mockResolvedValueOnce(kvResponse(50_000)); // PTTL

    const result = await checkRateLimit(key, 5, 60_000);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    // EXPIRE must not be sent for a pre-existing bucket
    const calledCommands = fetchMock.mock.calls.map((c) => c[0].split("/").pop());
    expect(calledCommands).not.toContain("EXPIRE");
  });

  it("peek reads GET/PTTL without incrementing", async () => {
    const key = uniqueKey("t-redis-peek");
    fetchMock
      .mockResolvedValueOnce(kvResponse(3)) // GET
      .mockResolvedValueOnce(kvResponse(45_000)); // PTTL

    const result = await peekRateLimit(key, 5, 60_000);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
    const calledCommands = fetchMock.mock.calls.map((c) => c[0].split("/").pop());
    expect(calledCommands).toEqual(["GET", "PTTL"]);
  });

  it("fails open when the Redis call throws", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const key = uniqueKey("t-redis-fail");
    fetchMock.mockRejectedValueOnce(new Error("connection refused"));

    const result = await safeCheckRateLimit(key, 5, 60_000);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(5);
    consoleSpy.mockRestore();
  });

  it("fails open when Redis returns a command error", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const key = uniqueKey("t-redis-err");
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });

    const result = await safeCheckRateLimit(key, 5, 60_000);

    expect(result.allowed).toBe(true);
    consoleSpy.mockRestore();
  });
});

describe("enforceAdminRateLimit", () => {
  const OLD_ENV = { ...process.env };

  beforeEach(() => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = { ...OLD_ENV };
  });

  it("returns null while under the cap (request passes)", async () => {
    const result = await enforceAdminRateLimit(requestWithIp("203.0.113.1"), "products");
    expect(result).toBeNull();
  });

  it("returns a 429 envelope with rate-limit headers once the cap is hit", async () => {
    const ip = `203.0.113.${Math.floor(Math.random() * 200) + 10}`;
    const req = requestWithIp(ip);
    let limited: Response | null = null;

    for (let i = 0; i < ADMIN_RATE_LIMIT.max + 1; i++) {
      const res = await enforceAdminRateLimit(req, "products");
      if (res) {
        limited = res;
        break;
      }
    }

    expect(limited).not.toBeNull();
    expect(limited!.status).toBe(429);
    const payload = await limited!.json();
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe("RATE_LIMITED");
    expect(limited!.headers.get("X-RateLimit-Limit")).toBe(String(ADMIN_RATE_LIMIT.max));
    expect(limited!.headers.get("X-RateLimit-Remaining")).toBe("0");
  });

  it("keys by route so one route's cap does not exhaust another", async () => {
    const ip = `203.0.113.${Math.floor(Math.random() * 200) + 210}`;
    const req = requestWithIp(ip);

    for (let i = 0; i < ADMIN_RATE_LIMIT.max; i++) {
      await enforceAdminRateLimit(req, "stats");
    }
    // A different route on the same IP is still allowed.
    expect(await enforceAdminRateLimit(req, "products")).toBeNull();
  });

  it("fails open when IP extraction throws", async () => {
    const badRequest = {
      headers: {
        get: () => {
          throw new Error("boom");
        },
      },
    };
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const result = await enforceAdminRateLimit(badRequest as unknown as Request, "products");
    expect(result).toBeNull();
    consoleSpy.mockRestore();
  });
});
