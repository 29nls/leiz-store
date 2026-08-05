/**
 * Tests for Admin Products API — /api/admin/products (GET + POST)
 *
 * Covers the standard response envelope ({ success, data, error, meta }) and
 * Zod validation paths: 200 (list), 201 (create), 400 (validation),
 * 401 (unauthenticated), 409 (slug conflict), 500 (database error).
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

import { GET, POST } from "@/app/api/admin/products/route";

function createQueryBuilder() {
  const qb: any = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
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
  mockResolveValue = { data: [], error: null };
});

function request(body?: unknown, url = "http://localhost/api/admin/products"): any {
  return { url, json: async () => body };
}

const validBody = {
  name: "Test Product",
  slug: "test-product",
  description: "A test product",
  price: 15000,
  comparePrice: 20000,
  unit: "pc",
  stock: 10,
  minStock: 3,
  badge: "HOT",
  isActive: true,
  isFeatured: false,
  categoryId: "cat-1",
};

const createdProduct = {
  id: "prod-1",
  name: "Test Product",
  slug: "test-product",
  price: 15000,
  category_id: "cat-1",
  is_active: true,
};

describe("GET /api/admin/products", () => {
  it("returns 200 with a paginated list and envelope meta", async () => {
    mockResolveValue = {
      data: [createdProduct, { ...createdProduct, id: "prod-2" }],
      error: null,
      count: 2,
    };

    const response = await GET(request(undefined) as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data).toHaveLength(2);
    expect(payload.meta).toEqual({ page: 1, limit: 20, total: 2, totalPages: 1 });
  });

  it("applies search, category, sort and pagination filters", async () => {
    const response = await GET(
      request(
        undefined,
        "http://localhost/api/admin/products?search=dragon&category=cat-9&sort=name&order=asc&page=3&limit=5"
      ) as never
    );

    expect(response.status).toBe(200);
    expect(mockQueryBuilder.or).toHaveBeenCalledWith(expect.stringContaining("name.ilike.%dragon%"));
    expect(mockQueryBuilder.eq).toHaveBeenCalledWith("category_id", "cat-9");
    expect(mockQueryBuilder.order).toHaveBeenCalledWith("name", { ascending: true });
    expect(mockQueryBuilder.range).toHaveBeenCalledWith(10, 14);
  });

  it("returns 401 when the request is not from an admin", async () => {
    mockIsAdminRequest.mockResolvedValue(false);

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

describe("POST /api/admin/products", () => {
  it("returns 201 and maps camelCase input to snake_case columns", async () => {
    mockResolveQueue = [
      { data: [], error: null }, // slug existence check
      { data: createdProduct, error: null }, // product insert
    ];

    const response = await POST(request(validBody) as never);
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.success).toBe(true);
    expect(payload.data).toEqual({
      product: createdProduct,
      message: "Product created successfully",
    });

    const insertArg = mockQueryBuilder.insert.mock.calls[0][0];
    expect(insertArg).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        name: "Test Product",
        slug: "test-product",
        price: 15000,
        compare_price: 20000,
        unit: "pc",
        stock: 10,
        min_stock: 3,
        badge: "HOT",
        is_active: true,
        is_featured: false,
        category_id: "cat-1",
      })
    );
  });

  it("inserts product images when provided", async () => {
    mockResolveQueue = [
      { data: [], error: null }, // slug existence check
      { data: createdProduct, error: null }, // product insert
      { data: null, error: null }, // product_image insert
    ];

    const response = await POST(
      request({
        ...validBody,
        images: [{ url: "https://img.test/1.png", alt: "Main", sortOrder: 0 }],
      }) as never
    );

    expect(response.status).toBe(201);
    const imageInsert = mockQueryBuilder.insert.mock.calls[1][0];
    expect(imageInsert).toEqual([
      expect.objectContaining({
        product_id: "prod-1",
        url: "https://img.test/1.png",
        alt: "Main",
        sort_order: 0,
      }),
    ]);
  });

  it("returns 400 with VALIDATION_ERROR for an invalid body", async () => {
    const response = await POST(request({ slug: "BAD SLUG!", price: -5 }) as never);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe("VALIDATION_ERROR");
    expect(mockQueryBuilder.insert).not.toHaveBeenCalled();
  });

  it("returns 401 when the request is not from an admin", async () => {
    mockIsAdminRequest.mockResolvedValue(false);

    const response = await POST(request(validBody) as never);
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error.code).toBe("UNAUTHORIZED");
    expect(mockQueryBuilder.insert).not.toHaveBeenCalled();
  });

  it("returns 409 when the slug already exists", async () => {
    mockResolveQueue = [{ data: [{ id: "existing" }], error: null }];

    const response = await POST(request(validBody) as never);
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe("CONFLICT");
    expect(payload.error.message).toContain("Slug");
    expect(mockQueryBuilder.insert).not.toHaveBeenCalled();
  });

  it("returns 500 when the product insert fails", async () => {
    mockResolveQueue = [
      { data: [], error: null }, // slug existence check
      { data: null, error: new Error("insert failed") }, // product insert
    ];

    const response = await POST(request(validBody) as never);
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error.code).toBe("INTERNAL_ERROR");
  });
});
