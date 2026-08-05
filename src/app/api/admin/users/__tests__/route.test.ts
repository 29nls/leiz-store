/**
 * Tests for Admin Users API — /api/admin/users (GET + POST)
 *
 * Covers the standard response envelope ({ success, data, error, meta }) and
 * Zod validation paths: 200 (list), 201 (create), 400 (validation),
 * 401 (unauthenticated), 409 (duplicate email), 500 (database error),
 * including the auth-user rollback when the public.user insert fails.
 */

// eslint-disable-next-line no-var -- var required for jest.mock hoisting
var mockRequireAdmin: jest.Mock;
// eslint-disable-next-line no-var -- var required for jest.mock hoisting
var mockHashPassword: jest.Mock;
// eslint-disable-next-line no-var -- var required for jest.mock hoisting
var mockListUsers: jest.Mock;
// eslint-disable-next-line no-var -- var required for jest.mock hoisting
var mockCreateUser: jest.Mock;
// eslint-disable-next-line no-var -- var required for jest.mock hoisting
var mockDeleteUser: jest.Mock;
// eslint-disable-next-line no-var -- var required for jest.mock hoisting
var mockQueryBuilder: any;
// eslint-disable-next-line no-var -- var required for jest.mock hoisting
var mockResolveQueue: Array<{ data: any; error: any; count?: number }>;
// eslint-disable-next-line no-var -- var required for jest.mock hoisting
var mockResolveValue: { data: any; error: any; count?: number };

jest.mock("next/server", () => {
  class MockResponse {
    status: number;
    private body: unknown;
    constructor(body: unknown, init?: { status?: number }) {
      this.body = body;
      this.status = init?.status || 200;
    }
    async json() {
      return this.body;
    }
  }
  return {
    NextResponse: {
      json: (data: unknown, init?: { status?: number }) => new MockResponse(data, init),
    },
  };
});

jest.mock("@/lib/supabase", () => ({
  get supabaseAdmin() {
    return {
      from: jest.fn().mockReturnValue(mockQueryBuilder),
      auth: {
        admin: {
          listUsers: (...args: unknown[]) => mockListUsers(...args),
          createUser: (...args: unknown[]) => mockCreateUser(...args),
          deleteUser: (...args: unknown[]) => mockDeleteUser(...args),
        },
      },
    };
  },
}));

jest.mock("@/lib/admin-auth", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

jest.mock("@/lib/auth", () => ({
  hashPassword: (...args: unknown[]) => mockHashPassword(...args),
}));

import { GET, POST } from "@/app/api/admin/users/route";
import { UnauthorizedError } from "@/lib/errors";

function createQueryBuilder() {
  const qb: any = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    then: jest.fn(function (this: any, resolve: any) {
      const value = mockResolveQueue.length > 0 ? mockResolveQueue.shift() : mockResolveValue;
      resolve(value);
    }),
  };
  return qb;
}

beforeAll(() => {
  mockRequireAdmin = jest.fn();
  mockHashPassword = jest.fn();
  mockListUsers = jest.fn();
  mockCreateUser = jest.fn();
  mockDeleteUser = jest.fn();
  mockQueryBuilder = createQueryBuilder();
});

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({ id: "admin-1", email: "admin@store.test", role: "ADMIN" });
  mockHashPassword.mockResolvedValue("hashed-password");
  mockListUsers.mockResolvedValue({ data: { users: [] }, error: null });
  mockCreateUser.mockResolvedValue({ data: { user: { id: "auth-1" } }, error: null });
  mockDeleteUser.mockResolvedValue({ data: null, error: null });
  Object.assign(mockQueryBuilder, createQueryBuilder());
  mockResolveQueue = [];
  mockResolveValue = { data: [], error: null };
});

function request(body?: unknown, url = "http://localhost/api/admin/users"): any {
  return { url, json: async () => body };
}

const validBody = {
  email: "newadmin@store.test",
  password: "secret123",
  name: "New Admin",
  role: "ADMIN",
  discord: "1234567890",
};

const listedUser = {
  id: "u1",
  email: "a@store.test",
  name: "Alice",
  role: "CUSTOMER",
  is_active: true,
  last_login_at: "2024-01-01T00:00:00.000Z",
};

describe("GET /api/admin/users", () => {
  it("returns 200 with a paginated list merged with auth last_sign_in_at", async () => {
    mockResolveValue = { data: [listedUser], error: null, count: 1 };
    mockListUsers.mockResolvedValue({
      data: {
        users: [{ email: "a@store.test", last_sign_in_at: "2024-02-01T00:00:00.000Z", banned_until: null }],
      },
      error: null,
    });

    const response = await GET(request(undefined) as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data).toHaveLength(1);
    expect(payload.data[0].last_sign_in_at).toBe("2024-02-01T00:00:00.000Z");
    expect(payload.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    expect(mockListUsers).toHaveBeenCalledWith({ perPage: 100 });
  });

  it("applies search and role filters", async () => {
    mockResolveValue = { data: [], error: null, count: 0 };

    const response = await GET(
      request(undefined, "http://localhost/api/admin/users?search=alice&role=CUSTOMER&limit=5") as never
    );

    expect(response.status).toBe(200);
    expect(mockQueryBuilder.or).toHaveBeenCalledWith(expect.stringContaining("name.ilike.%alice%"));
    expect(mockQueryBuilder.eq).toHaveBeenCalledWith("role", "CUSTOMER");
    expect(mockQueryBuilder.range).toHaveBeenCalledWith(0, 4);
  });

  it("skips the auth listUsers call when there are more than 50 users", async () => {
    mockResolveValue = { data: [listedUser], error: null, count: 60 };

    await GET(request(undefined) as never);

    expect(mockListUsers).not.toHaveBeenCalled();
  });

  it("returns 401 when the request is not authenticated", async () => {
    mockRequireAdmin.mockRejectedValue(new UnauthorizedError());

    const response = await GET(request(undefined) as never);
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe("UNAUTHORIZED");
    expect(mockQueryBuilder.select).not.toHaveBeenCalled();
  });

  it("returns 500 when the database query fails", async () => {
    mockResolveValue = { data: null, error: new Error("connection refused") };

    const response = await GET(request(undefined) as never);
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error.code).toBe("INTERNAL_ERROR");
  });
});

describe("POST /api/admin/users", () => {
  it("returns 201 with the created user and a 25-char id", async () => {
    mockResolveQueue = [
      { data: [], error: null }, // email existence check
      { data: null, error: null }, // public.user insert
    ];

    const response = await POST(request(validBody) as never);
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.success).toBe(true);
    expect(payload.data.user).toEqual(
      expect.objectContaining({
        email: "newadmin@store.test",
        name: "New Admin",
        role: "ADMIN",
        is_active: true,
      })
    );
    expect(payload.data.user.id).toHaveLength(25);
    expect(mockHashPassword).toHaveBeenCalledWith("secret123");

    const insertArg = mockQueryBuilder.insert.mock.calls[0][0];
    expect(insertArg).toEqual(
      expect.objectContaining({
        email: "newadmin@store.test",
        name: "New Admin",
        role: "ADMIN",
        discord: "1234567890",
        password: "hashed-password",
        is_active: true,
      })
    );
  });

  it("returns 400 with VALIDATION_ERROR for an invalid body", async () => {
    const response = await POST(
      request({ email: "not-an-email", password: "123", name: "" }) as never
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe("VALIDATION_ERROR");
    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(mockQueryBuilder.insert).not.toHaveBeenCalled();
  });

  it("returns 401 when the request is not authenticated", async () => {
    mockRequireAdmin.mockRejectedValue(new UnauthorizedError());

    const response = await POST(request(validBody) as never);
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error.code).toBe("UNAUTHORIZED");
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it("returns 409 when the email already exists in public.user", async () => {
    mockResolveQueue = [{ data: [{ id: "existing" }], error: null }];

    const response = await POST(request(validBody) as never);
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.error.code).toBe("CONFLICT");
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it("returns 409 when Supabase Auth reports the user already exists", async () => {
    mockResolveQueue = [{ data: [], error: null }];
    mockCreateUser.mockResolvedValue({
      data: null,
      error: { message: "A user with this email address already exists" },
    });

    const response = await POST(request(validBody) as never);
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.error.code).toBe("CONFLICT");
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it("returns 500 and rolls back the auth user when the public.user insert fails", async () => {
    mockResolveQueue = [
      { data: [], error: null }, // email existence check
      { data: null, error: new Error("insert failed") }, // public.user insert
    ];

    const response = await POST(request(validBody) as never);
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error.code).toBe("INTERNAL_ERROR");
    expect(mockDeleteUser).toHaveBeenCalledWith("auth-1");
  });
});
