/**
 * Tests for Admin Orders API — /api/admin/orders (GET list)
 *
 * Covers the standard response envelope ({ success, data, error, meta }):
 * 200 (list), 401 (unauthenticated), 500 (database error).
 *
 * Note: 400/404 status codes for orders live in the single-order route
 * (PUT transition validation / GET|PUT not-found) — see
 * `src/app/api/admin/orders/[id]/__tests__/route.test.ts`.
 */

// eslint-disable-next-line no-var -- var required for jest.mock hoisting
var mockIsAdminRequest: jest.Mock;
// eslint-disable-next-line no-var -- var required for jest.mock hoisting
var mockQueryBuilder: any;
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

import { GET } from "@/app/api/admin/orders/route";

function createQueryBuilder() {
  const qb: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    then: jest.fn(function (this: any, resolve: any) {
      resolve(mockResolveValue);
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
  mockResolveValue = { data: [], error: null };
});

function request(url = "http://localhost/api/admin/orders"): any {
  return { url };
}

const orderRow = {
  id: "order-1",
  order_number: "LZ-20260805-ABC123",
  customer_name: "Test Customer",
  status: "PENDING_PAYMENT",
  total: 15000,
};

describe("GET /api/admin/orders", () => {
  it("returns 200 with a paginated list and envelope meta", async () => {
    mockResolveValue = {
      data: [orderRow, { ...orderRow, id: "order-2", order_number: "LZ-20260805-DEF456" }],
      error: null,
      count: 2,
    };

    const response = await GET(request() as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data).toHaveLength(2);
    expect(payload.meta).toEqual({ page: 1, limit: 20, total: 2, totalPages: 1 });
  });

  it("applies search and status filters (status uppercased)", async () => {
    const response = await GET(
      request(
        "http://localhost/api/admin/orders?search=joko&status=pending_payment&limit=5&page=2"
      ) as never
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockQueryBuilder.or).toHaveBeenCalledWith(
      expect.stringContaining("order_number.ilike.%joko%")
    );
    expect(mockQueryBuilder.eq).toHaveBeenCalledWith("status", "PENDING_PAYMENT");
    expect(mockQueryBuilder.range).toHaveBeenCalledWith(5, 9);
    expect(payload.meta.page).toBe(2);
  });

  it("returns 401 when the request is not from an admin", async () => {
    mockIsAdminRequest.mockResolvedValue(false);

    const response = await GET(request() as never);
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe("UNAUTHORIZED");
    expect(mockQueryBuilder.select).not.toHaveBeenCalled();
  });

  it("returns 500 when the database query fails", async () => {
    mockResolveValue = { data: null, error: new Error("connection refused") };

    const response = await GET(request() as never);
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error.code).toBe("INTERNAL_ERROR");
  });
});
