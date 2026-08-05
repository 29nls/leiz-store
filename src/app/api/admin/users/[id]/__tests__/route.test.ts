/**
 * Tests for Admin Single User API — /api/admin/users/[id] (GET + PATCH + DELETE)
 *
 * Covers the standard response envelope ({ success, data, error, meta }):
 * 200 (get/update/deactivate), 400 (validation / last-admin guard),
 * 401 (unauthenticated), 404 (user not found), 500 (database error).
 */

// eslint-disable-next-line no-var -- var required for jest.mock hoisting
var mockRequireAdmin: jest.Mock;
// eslint-disable-next-line no-var -- var required for jest.mock hoisting
var mockListUsers: jest.Mock;
// eslint-disable-next-line no-var -- var required for jest.mock hoisting
var mockUpdateUserById: jest.Mock;
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
          updateUserById: (...args: unknown[]) => mockUpdateUserById(...args),
        },
      },
    };
  },
}));

jest.mock("@/lib/admin-auth", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

import { GET, PATCH, DELETE } from "@/app/api/admin/users/[id]/route";
import { UnauthorizedError } from "@/lib/errors";

function createQueryBuilder() {
  const qb: any = {
    select: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    then: jest.fn(function (this: any, resolve: any) {
      const value = mockResolveQueue.length > 0 ? mockResolveQueue.shift() : mockResolveValue;
      resolve(value);
    }),
  };
  return qb;
}

beforeAll(() => {
  mockRequireAdmin = jest.fn();
  mockListUsers = jest.fn();
  mockUpdateUserById = jest.fn();
  mockQueryBuilder = createQueryBuilder();
});

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({ id: "admin-1", email: "admin@store.test", role: "ADMIN" });
  mockListUsers.mockResolvedValue({ data: { users: [] }, error: null });
  mockUpdateUserById.mockResolvedValue({ data: null, error: null });
  Object.assign(mockQueryBuilder, createQueryBuilder());
  mockResolveQueue = [];
  mockResolveValue = { data: null, error: null };
});

function request(body?: unknown): any {
  return { json: async () => body };
}

const params = () => Promise.resolve({ id: "user-1" });

const customerUser = {
  id: "user-1",
  email: "customer@store.test",
  name: "Customer",
  role: "CUSTOMER",
  is_active: true,
};

const adminUser = {
  id: "admin-1",
  email: "admin@store.test",
  name: "Admin",
  role: "ADMIN",
  is_active: true,
};

describe("GET /api/admin/users/[id]", () => {
  it("returns 200 with the user", async () => {
    mockResolveQueue = [{ data: customerUser, error: null }];

    const response = await GET(request() as never, { params: params() });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data).toEqual(customerUser);
  });

  it("returns 401 when the request is not authenticated", async () => {
    mockRequireAdmin.mockRejectedValue(new UnauthorizedError());

    const response = await GET(request() as never, { params: params() });
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error.code).toBe("UNAUTHORIZED");
    expect(mockQueryBuilder.select).not.toHaveBeenCalled();
  });

  it("returns 404 when the user does not exist", async () => {
    const response = await GET(request() as never, { params: params() });
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error.code).toBe("NOT_FOUND");
  });
});

describe("PATCH /api/admin/users/[id]", () => {
  it("returns 200 and updates the user", async () => {
    mockResolveQueue = [
      { data: customerUser, error: null }, // verify exists
      { data: null, error: null }, // public.user update
    ];

    const response = await PATCH(request({ name: "New Name", role: "CUSTOMER" }) as never, {
      params: params(),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toEqual({ message: "User berhasil diperbarui" });
    const updateArg = mockQueryBuilder.update.mock.calls[0][0];
    expect(updateArg).toEqual(
      expect.objectContaining({ name: "New Name", role: "CUSTOMER", updated_at: expect.any(String) })
    );
    expect(mockListUsers).not.toHaveBeenCalled();
  });

  it("updates the Auth password when a new one is provided", async () => {
    mockResolveQueue = [
      { data: customerUser, error: null }, // verify exists
      { data: null, error: null }, // public.user update
    ];
    mockListUsers.mockResolvedValue({
      data: { users: [{ id: "auth-1", email: "customer@store.test" }] },
      error: null,
    });

    const response = await PATCH(request({ password: "newpass123" }) as never, {
      params: params(),
    });

    expect(response.status).toBe(200);
    expect(mockUpdateUserById).toHaveBeenCalledWith("auth-1", { password: "newpass123" });
  });

  it("unbans the Auth user when reactivating", async () => {
    mockResolveQueue = [
      { data: customerUser, error: null }, // verify exists
      { data: null, error: null }, // public.user update
    ];
    mockListUsers.mockResolvedValue({
      data: { users: [{ id: "auth-1", email: "customer@store.test" }] },
      error: null,
    });

    const response = await PATCH(request({ is_active: true }) as never, { params: params() });

    expect(response.status).toBe(200);
    expect(mockUpdateUserById).toHaveBeenCalledWith("auth-1", { ban_duration: "0" });
  });

  it("returns 400 with VALIDATION_ERROR for an empty body", async () => {
    const response = await PATCH(request({}) as never, { params: params() });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe("VALIDATION_ERROR");
    expect(mockQueryBuilder.update).not.toHaveBeenCalled();
  });

  it("returns 401 when the request is not authenticated", async () => {
    mockRequireAdmin.mockRejectedValue(new UnauthorizedError());

    const response = await PATCH(request({ name: "X" }) as never, { params: params() });
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 404 when the user does not exist", async () => {
    mockResolveQueue = [{ data: null, error: null }];

    const response = await PATCH(request({ name: "X" }) as never, { params: params() });
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error.code).toBe("NOT_FOUND");
    expect(mockQueryBuilder.update).not.toHaveBeenCalled();
  });

  it("returns 500 when the update fails", async () => {
    mockResolveQueue = [
      { data: customerUser, error: null }, // verify exists
      { data: null, error: new Error("update failed") }, // public.user update
    ];

    const response = await PATCH(request({ name: "X" }) as never, { params: params() });
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error.code).toBe("INTERNAL_ERROR");
  });
});

describe("DELETE /api/admin/users/[id]", () => {
  it("returns 200 and soft-deletes a customer", async () => {
    mockResolveQueue = [
      { data: customerUser, error: null }, // verify exists
      { data: null, error: null }, // soft delete
    ];

    const response = await DELETE(request() as never, { params: params() });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toEqual({ message: "User berhasil dinonaktifkan" });
    const updateArg = mockQueryBuilder.update.mock.calls[0][0];
    expect(updateArg).toEqual(
      expect.objectContaining({ is_active: false, updated_at: expect.any(String) })
    );
  });

  it("allows deactivating an admin when another active admin exists", async () => {
    mockResolveQueue = [
      { data: adminUser, error: null }, // verify exists
      { data: null, error: null, count: 2 }, // active admin count
      { data: null, error: null }, // soft delete
    ];

    const response = await DELETE(request() as never, { params: params() });

    expect(response.status).toBe(200);
    expect(mockQueryBuilder.update).toHaveBeenCalled();
  });

  it("returns 400 when trying to deactivate the last active admin", async () => {
    mockResolveQueue = [
      { data: adminUser, error: null }, // verify exists
      { data: null, error: null, count: 1 }, // active admin count
    ];

    const response = await DELETE(request() as never, { params: params() });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe("VALIDATION_ERROR");
    expect(payload.error.message).toContain("admin terakhir");
    expect(mockQueryBuilder.update).not.toHaveBeenCalled();
  });

  it("returns 401 when the request is not authenticated", async () => {
    mockRequireAdmin.mockRejectedValue(new UnauthorizedError());

    const response = await DELETE(request() as never, { params: params() });
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 404 when the user does not exist", async () => {
    mockResolveQueue = [{ data: null, error: null }];

    const response = await DELETE(request() as never, { params: params() });
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error.code).toBe("NOT_FOUND");
  });

  it("returns 500 when the soft delete fails", async () => {
    mockResolveQueue = [
      { data: customerUser, error: null }, // verify exists
      { data: null, error: new Error("update failed") }, // soft delete
    ];

    const response = await DELETE(request() as never, { params: params() });
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error.code).toBe("INTERNAL_ERROR");
  });
});
