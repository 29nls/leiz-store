const mockSignIn = jest.fn();
const mockSignOut = jest.fn();
const mockMaybeSingle = jest.fn();

jest.mock("next/server", () => {
  class MockResponse {
    status: number;
    private body: unknown;
    headers: Map<string, string>;
    cookies = { set: jest.fn() };

    constructor(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
      this.body = body;
      this.status = init?.status || 200;
      this.headers = new Map(Object.entries(init?.headers || {}));
    }

    async json() {
      return this.body;
    }
  }
  return {
    NextResponse: {
      json: (data: unknown, init?: { status?: number; headers?: Record<string, string> }) =>
        new MockResponse(data, init),
    },
  };
});

jest.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignIn(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
    },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: (...args: unknown[]) => mockMaybeSingle(...args) }) }),
    }),
  },
}));

jest.mock("@/lib/auth", () => ({
  signJWT: () => "test-signed-token",
}));

// The real middleware module (and its in-memory limiter) is used on purpose,
// so these tests exercise the actual brute-force protection logic. The store
// is shared across tests in this file, so every test uses a unique email and
// IP to keep its rate-limit buckets isolated.
import { POST } from "@/app/api/admin/login/route";
import { LOGIN_RATE_LIMIT } from "@/lib/middleware";

function request(body: unknown, ip: string): { headers: Headers; json: () => Promise<unknown> } {
  return {
    headers: new Headers({ "x-forwarded-for": ip }),
    json: async () => body,
  };
}

const failLogin = (email: string, password: string, ip: string) =>
  POST(request({ email, password }, ip) as never);

describe("POST /api/admin/login brute-force protection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 for a failed login and 429 once the per-account limit is hit", async () => {
    const email = `acct-${Date.now()}@test.local`;
    const ip = "203.0.113.11";
    mockSignIn.mockResolvedValue({ data: { user: null }, error: { message: "Invalid login credentials" } });

    // accountMax failures are allowed (each 401), the next attempt is blocked.
    for (let i = 0; i < LOGIN_RATE_LIMIT.accountMax; i++) {
      expect((await failLogin(email, "wrong", ip)).status).toBe(401);
    }
    expect((await failLogin(email, "wrong", ip)).status).toBe(429);
  });

  it("blocks by IP even when the attacker rotates accounts", async () => {
    const ip = "203.0.113.20";
    mockSignIn.mockResolvedValue({ data: { user: null }, error: { message: "Invalid login credentials" } });

    // One failure per distinct account keeps every account bucket under its cap,
    // but the shared IP bucket accumulates.
    for (let i = 0; i < LOGIN_RATE_LIMIT.ipMax; i++) {
      expect((await failLogin(`rotating-${Date.now()}-${i}@example.com`, "x", ip)).status).toBe(401);
    }
    expect((await failLogin(`rotating-last-${Date.now()}@example.com`, "x", ip)).status).toBe(429);
  });

  it("restores access after the lockout window expires", async () => {
    const email = `expiry-${Date.now()}@test.local`;
    const ip = "203.0.113.30";

    jest.useFakeTimers();
    try {
      mockSignIn.mockResolvedValue({ data: { user: null }, error: { message: "Invalid login credentials" } });
      for (let i = 0; i < LOGIN_RATE_LIMIT.accountMax; i++) {
        await failLogin(email, "wrong", ip);
      }
      expect((await failLogin(email, "wrong", ip)).status).toBe(429);

      // After the window expires, a correct login succeeds.
      mockSignIn.mockResolvedValue({ data: { user: { email } }, error: null });
      mockMaybeSingle.mockResolvedValue({
        data: { id: "u1", email, name: "Admin", role: "ADMIN", is_active: true },
        error: null,
      });

      jest.advanceTimersByTime(LOGIN_RATE_LIMIT.windowMs + 1);
      expect((await failLogin(email, "correct-password", ip)).status).toBe(200);
    } finally {
      jest.useRealTimers();
    }
  });

  it("a successful login clears the failure counters", async () => {
    const email = `reset-${Date.now()}@test.local`;
    const ip = "203.0.113.40";
    mockSignIn.mockResolvedValue({ data: { user: null }, error: { message: "Invalid login credentials" } });

    // Almost at the account cap.
    for (let i = 0; i < LOGIN_RATE_LIMIT.accountMax - 1; i++) {
      expect((await failLogin(email, "wrong", ip)).status).toBe(401);
    }

    // Successful login resets both buckets.
    mockSignIn.mockResolvedValue({ data: { user: { email } }, error: null });
    mockMaybeSingle.mockResolvedValue({
      data: { id: "u1", email, name: "Admin", role: "ADMIN", is_active: true },
      error: null,
    });
    expect((await failLogin(email, "correct-password", ip)).status).toBe(200);

    // A later failure is not blocked because the counters were reset.
    mockSignIn.mockResolvedValue({ data: { user: null }, error: { message: "Invalid login credentials" } });
    expect((await failLogin(email, "wrong", ip)).status).toBe(401);
  });

  it("rejects a request without credentials before any rate limiting", async () => {
    const response = await POST(request({ email: "", password: "" }, "203.0.113.50") as never);
    expect(response.status).toBe(400);
  });
});
