/**
 * Tests for Admin Single Order API — /api/admin/orders/[id] (GET + PUT + DELETE)
 *
 * Covers the standard response envelope ({ success, data, error, meta }) and the
 * order-specific error paths: 200 (get/update/delete), 400 (invalid status
 * transition), 401 (unauthenticated), 404 (order not found), 500 (database error).
 */

// eslint-disable-next-line no-var -- var required for jest.mock hoisting
var mockIsAdminRequest: jest.Mock;
// eslint-disable-next-line no-var -- var required for jest.mock hoisting
var mockAuthenticateAdmin: jest.Mock;
// eslint-disable-next-line no-var -- var required for jest.mock hoisting
var mockLogStatusChange: jest.Mock;
// eslint-disable-next-line no-var -- var required for jest.mock hoisting
var mockSendBuyerNotification: jest.Mock;
// eslint-disable-next-line no-var -- var required for jest.mock hoisting
var mockSupabaseAdmin: any;
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
    return mockSupabaseAdmin;
  },
}));

jest.mock("@/lib/admin-auth", () => ({
  isAdminRequest: (...args: unknown[]) => mockIsAdminRequest(...args),
  authenticateAdmin: (...args: unknown[]) => mockAuthenticateAdmin(...args),
}));

jest.mock("@/lib/payment/order-logger", () => ({
  logOrderStatusChange: (...args: unknown[]) => mockLogStatusChange(...args),
}));

jest.mock("@/lib/discord/bot", () => ({
  sendBuyerNotification: (...args: unknown[]) => mockSendBuyerNotification(...args),
}));

// isValidTransition from @/lib/payment/constants is pure — the real module is used.
import { GET, PUT, DELETE } from "@/app/api/admin/orders/[id]/route";

function createQueryBuilder() {
  const qb: any = {
    select: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
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
  mockIsAdminRequest = jest.fn();
  mockAuthenticateAdmin = jest.fn();
  mockLogStatusChange = jest.fn();
  mockSendBuyerNotification = jest.fn();
  mockQueryBuilder = createQueryBuilder();
  mockSupabaseAdmin = { from: jest.fn().mockReturnValue(mockQueryBuilder) };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAdminRequest.mockResolvedValue(true);
  mockAuthenticateAdmin.mockResolvedValue({ id: "admin-1", email: "admin@store.test" });
  mockLogStatusChange.mockResolvedValue({});
  mockSendBuyerNotification.mockResolvedValue({});
  mockSupabaseAdmin.from.mockReturnValue(mockQueryBuilder);
  Object.assign(mockQueryBuilder, createQueryBuilder());
  mockResolveQueue = [];
  mockResolveValue = { data: null, error: null };
});

function request(body?: unknown): any {
  return { json: async () => body };
}

const params = () => Promise.resolve({ id: "order-1" });

const currentOrder = {
  id: "order-1",
  order_number: "LZ-20260805-ABC123",
  customer_name: "Test Customer",
  status: "WAITING_CONFIRMATION",
  buyer_discord_id: "1234567890",
};

describe("GET /api/admin/orders/[id]", () => {
  it("returns 200 with the order", async () => {
    mockResolveValue = { data: currentOrder, error: null };

    const response = await GET(request() as never, { params: params() });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data).toEqual(currentOrder);
  });

  it("returns 401 when the request is not from an admin", async () => {
    mockIsAdminRequest.mockResolvedValue(false);

    const response = await GET(request() as never, { params: params() });
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 404 when the order does not exist", async () => {
    const response = await GET(request() as never, { params: params() });
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error.code).toBe("NOT_FOUND");
    expect(payload.error.message).toContain("order-1");
  });

  it("returns 500 when the database query fails", async () => {
    mockResolveValue = { data: null, error: new Error("connection refused") };

    const response = await GET(request() as never, { params: params() });
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error.code).toBe("INTERNAL_ERROR");
  });
});

describe("PUT /api/admin/orders/[id]", () => {
  it("returns 200 for a valid transition and notifies the buyer", async () => {
    mockResolveQueue = [
      { data: currentOrder, error: null }, // fetch current order
      { data: null, error: null }, // payment table update (PAID)
      { data: { ...currentOrder, status: "PAID" }, error: null }, // order update
    ];

    const response = await PUT(request({ status: "PAID", customerName: "Updated Name" }) as never, {
      params: params(),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toEqual({
      order: { ...currentOrder, status: "PAID" },
      message: "Order updated successfully",
    });
    // payment row is synced when the order becomes PAID
    expect(mockSupabaseAdmin.from).toHaveBeenCalledWith("payment");
    // status change is logged with the admin identity
    expect(mockLogStatusChange).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "order-1",
        actorId: "admin-1",
        previousStatus: "WAITING_CONFIRMATION",
        newStatus: "PAID",
      })
    );
    expect(mockSendBuyerNotification).toHaveBeenCalledWith(
      "1234567890",
      "LZ-20260805-ABC123",
      expect.stringContaining("Pembayaran Anda telah diverifikasi")
    );
  });

  it("returns 400 with VALIDATION_ERROR for an invalid status transition", async () => {
    mockResolveQueue = [{ data: currentOrder, error: null }];

    const response = await PUT(request({ status: "PROCESSING" }) as never, { params: params() });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe("VALIDATION_ERROR");
    expect(mockLogStatusChange).not.toHaveBeenCalled();
    expect(mockQueryBuilder.update).not.toHaveBeenCalled();
  });

  it("returns 401 when the request is not from an admin", async () => {
    mockIsAdminRequest.mockResolvedValue(false);

    const response = await PUT(request({ status: "PAID" }) as never, { params: params() });
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 404 when the order does not exist", async () => {
    const response = await PUT(request({ status: "PAID" }) as never, { params: params() });
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error.code).toBe("NOT_FOUND");
  });

  it("returns 500 when the order update fails", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockResolveQueue = [
      { data: currentOrder, error: null }, // fetch current order
      { data: null, error: null }, // payment table update
      { data: null, error: new Error("update failed") }, // order update
    ];

    const response = await PUT(request({ status: "PAID" }) as never, { params: params() });
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error.code).toBe("INTERNAL_ERROR");
    consoleSpy.mockRestore();
  });
});

describe("DELETE /api/admin/orders/[id]", () => {
  it("returns 200 and deletes items, payment and order in order", async () => {
    mockResolveQueue = [
      { data: null, error: null }, // order_item delete
      { data: null, error: null }, // payment delete
      { data: null, error: null }, // order delete
    ];

    const response = await DELETE(request() as never, { params: params() });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toEqual({ message: "Order deleted successfully" });
    expect(mockSupabaseAdmin.from).toHaveBeenNthCalledWith(1, "order_item");
    expect(mockSupabaseAdmin.from).toHaveBeenNthCalledWith(2, "payment");
    expect(mockSupabaseAdmin.from).toHaveBeenNthCalledWith(3, "order");
  });

  it("returns 401 when the request is not from an admin", async () => {
    mockIsAdminRequest.mockResolvedValue(false);

    const response = await DELETE(request() as never, { params: params() });
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error.code).toBe("UNAUTHORIZED");
    expect(mockSupabaseAdmin.from).not.toHaveBeenCalled();
  });

  it("returns 500 when the order delete fails", async () => {
    mockResolveQueue = [
      { data: null, error: null },
      { data: null, error: null },
      { data: null, error: new Error("delete failed") },
    ];

    const response = await DELETE(request() as never, { params: params() });
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error.code).toBe("INTERNAL_ERROR");
  });
});
