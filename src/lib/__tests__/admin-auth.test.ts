/* eslint-disable no-var -- var required for jest.mock hoisting */
var mockGetUser: any;
var mockMaybeSingle: any;
var mockFrom: any;
var mockQueryBuilder: any;

mockGetUser = jest.fn();
mockMaybeSingle = jest.fn();
mockQueryBuilder = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  maybeSingle: mockMaybeSingle,
};
mockFrom = jest.fn().mockReturnValue(mockQueryBuilder);

jest.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    auth: { getUser: mockGetUser },
    from: mockFrom,
  },
}));

import { authenticateAdmin } from "@/lib/admin-auth";
import { signJWT } from "@/lib/auth";

/** Minimal request stand-in exposing only the headers authenticateAdmin uses. */
function makeRequest(authorization: string): Request {
  return {
    headers: {
      get: (name: string) => (name === "authorization" ? authorization : null),
    },
  } as unknown as Request;
}

describe("admin-auth legacy JWT re-validation (LOW-1)", () => {
  const legacyToken = signJWT({
    sub: "admin",
    email: "admin@example.com",
    role: "ADMIN",
  });

  const activeAdminProfile = {
    id: "db-admin-1",
    email: "admin@example.com",
    name: "Admin",
    role: "ADMIN",
    is_active: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Supabase Auth is the primary path; make it yield no user so the legacy
    // fallback is exercised.
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    // Default: profile not found. Tests that expect a lookup override this.
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  });

  it("accepts a legacy JWT when the profile is an active ADMIN", async () => {
    mockMaybeSingle.mockResolvedValue({ data: activeAdminProfile, error: null });

    const identity = await authenticateAdmin(makeRequest(`Bearer ${legacyToken}`));

    expect(identity).toEqual({
      id: "db-admin-1",
      email: "admin@example.com",
      name: "Admin",
      source: "legacy-jwt",
    });
    expect(mockFrom).toHaveBeenCalledWith("user");
  });

  it("rejects a legacy JWT when the profile is not found", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    expect(await authenticateAdmin(makeRequest(`Bearer ${legacyToken}`))).toBeNull();
  });

  it("rejects a legacy JWT when the profile role is not ADMIN", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { ...activeAdminProfile, role: "CUSTOMER" },
      error: null,
    });

    expect(await authenticateAdmin(makeRequest(`Bearer ${legacyToken}`))).toBeNull();
  });

  it("rejects a legacy JWT for a deactivated admin (is_active === false)", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { ...activeAdminProfile, is_active: false },
      error: null,
    });

    expect(await authenticateAdmin(makeRequest(`Bearer ${legacyToken}`))).toBeNull();
  });

  it("fails closed when the profile lookup errors", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: "db down" } });

    expect(await authenticateAdmin(makeRequest(`Bearer ${legacyToken}`))).toBeNull();
  });

  it("rejects an invalid legacy token without touching the database", async () => {
    expect(await authenticateAdmin(makeRequest("Bearer invalid.token.here"))).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("rejects a legacy JWT carrying a non-ADMIN role claim", async () => {
    const customerToken = signJWT({
      sub: "customer",
      email: "customer@example.com",
      role: "CUSTOMER",
    });

    expect(await authenticateAdmin(makeRequest(`Bearer ${customerToken}`))).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
