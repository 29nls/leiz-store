/**
 * Tests for Admin Single Product API — /api/admin/products/[id] (PUT + DELETE)
 *
 * Covers the standard response envelope ({ success, data, error, meta }) and the
 * product-specific error paths: 200 (update/delete), 400 (validation),
 * 401 (unauthenticated), 404 (product not found), 409 (slug conflict on update),
 * 500 (database error).
 */

// eslint-disable-next-line no-var -- var required for jest.mock hoisting
var mockIsAdminRequest: jest.Mock;
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
    return { from: jest.fn().mockReturnValue(mockQueryBuilder) };
  },
}));

jest.mock("@/lib/admin-auth", () => ({
  isAdminRequest: (...args: unknown[]) => mockIsAdminRequest(...args),
}));

import { PUT, DELETE } from "@/app/api/admin/products/[id]/route";

function createQueryBuilder() {
  const qb: any = {
    select: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    then: jest.fn(function (this: any, resolve: any) {
      const value = mockResolveQueue.length > 0 ? mockResolveQueue.shift() : mockResolveValue;
      resolve(value);
    }),
  };
  return qb;
}

beforeAll(() => {
  mockIsAdminRequest = jest.fn();
  mockQueryBuilder = createQueryBuilder();
});

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAdminRequest.mockResolvedValue(true);
  Object.assign(mockQueryBuilder, createQueryBuilder());
  mockResolveQueue = [];
  mockResolveValue = { data: null, error: null };
});

function request(body?: unknown): any {
  return { json: async () => body };
}

const params = () => Promise.resolve({ id: "prod-1" });

const updatedProduct = { id: "prod-1", name: "Updated", slug: "updated", price: 25000 };

describe("PUT /api/admin/products/[id]", () => {
  it("returns 200 and maps camelCase fields to snake_case", async () => {
    mockResolveQueue = [
      { data: [{ id: "prod-1" }], error: null }, // existing product
      { data: updatedProduct, error: null }, // product update
    ];

    const response = await PUT(
      request({ name: "Updated", price: 25000, isActive: false }) as never,
      { params: params() }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toEqual({
      product: updatedProduct,
      message: "Product updated successfully",
    });

    const updateArg = mockQueryBuilder.update.mock.calls[0][0];
    expect(updateArg).toEqual(
      expect.objectContaining({
        name: "Updated",
        price: 25000,
        is_active: false,
        updated_at: expect.any(String),
      })
    );
  });

  it("replaces product images when provided", async () => {
    mockResolveQueue = [
      { data: [{ id: "prod-1" }], error: null }, // existing product
      { data: updatedProduct, error: null }, // product update
      { data: null, error: null }, // old images delete
      { data: null, error: null }, // new images insert
    ];

    const response = await PUT(
      request({ images: [{ url: "https://img.test/new.png", sortOrder: 2 }] }) as never,
      { params: params() }
    );

    expect(response.status).toBe(200);
    const insertArg = mockQueryBuilder.insert.mock.calls[0][0];
    expect(insertArg).toEqual([
      expect.objectContaining({
        product_id: "prod-1",
        url: "https://img.test/new.png",
        sort_order: 2,
      }),
    ]);
  });

  it("returns 400 with VALIDATION_ERROR for an invalid body", async () => {
    const response = await PUT(request({ price: "not-a-number" }) as never, { params: params() });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe("VALIDATION_ERROR");
    expect(mockQueryBuilder.update).not.toHaveBeenCalled();
  });

  it("returns 401 when the request is not from an admin", async () => {
    mockIsAdminRequest.mockResolvedValue(false);

    const response = await PUT(request({ name: "X" }) as never, { params: params() });
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 404 when the product does not exist", async () => {
    mockResolveQueue = [{ data: [], error: null }];

    const response = await PUT(request({ name: "X" }) as never, { params: params() });
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error.code).toBe("NOT_FOUND");
    expect(payload.error.message).toContain("prod-1");
    expect(mockQueryBuilder.update).not.toHaveBeenCalled();
  });

  it("returns 409 when the new slug is already used by another product", async () => {
    mockResolveQueue = [
      { data: [{ id: "prod-1" }], error: null }, // existing product
      { data: [{ id: "other-prod" }], error: null }, // slug uniqueness check
    ];

    const response = await PUT(request({ slug: "taken-slug" }) as never, { params: params() });
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.error.code).toBe("CONFLICT");
    expect(payload.error.message).toContain("Slug");
    expect(mockQueryBuilder.update).not.toHaveBeenCalled();
  });

  it("returns 500 when the product update fails", async () => {
    mockResolveQueue = [
      { data: [{ id: "prod-1" }], error: null }, // existing product
      { data: null, error: new Error("update failed") }, // product update
    ];

    const response = await PUT(request({ name: "X" }) as never, { params: params() });
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error.code).toBe("INTERNAL_ERROR");
  });
});

describe("DELETE /api/admin/products/[id]", () => {
  it("returns 200 and soft-deletes by setting is_active=false", async () => {
    mockResolveQueue = [{ data: null, error: null }];

    const response = await DELETE(request() as never, { params: params() });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toEqual({ message: "Produk berhasil dinonaktifkan" });
    const updateArg = mockQueryBuilder.update.mock.calls[0][0];
    expect(updateArg).toEqual(
      expect.objectContaining({ is_active: false, updated_at: expect.any(String) })
    );
  });

  it("returns 401 when the request is not from an admin", async () => {
    mockIsAdminRequest.mockResolvedValue(false);

    const response = await DELETE(request() as never, { params: params() });
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error.code).toBe("UNAUTHORIZED");
    expect(mockQueryBuilder.update).not.toHaveBeenCalled();
  });

  it("returns 500 when the update fails", async () => {
    mockResolveQueue = [{ data: null, error: new Error("delete failed") }];

    const response = await DELETE(request() as never, { params: params() });
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error.code).toBe("INTERNAL_ERROR");
  });
});
