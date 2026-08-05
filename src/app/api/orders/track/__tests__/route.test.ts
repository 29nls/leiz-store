class MockResponse {
  status: number;
  private body: unknown;
  constructor(body: unknown, init?: { status?: number }) {
    this.body = body;
    this.status = init?.status || 200;
  }
  async json() { return this.body; }
}

// The track route uses the global fetch Response, which is not available in
// the Node test runtime.
global.Response = {
  json: (data: unknown, init?: { status?: number }) => new MockResponse(data, init),
} as unknown as typeof Response;

const mockCookiesGet = jest.fn();
const mockValidateToken = jest.fn();
const mockGetOrderForPayment = jest.fn();
const mockFindByOrderNumber = jest.fn();

jest.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: mockCookiesGet }),
}));

jest.mock("@/lib/payment/payment-service", () => ({
  getOrderForPayment: (...args: unknown[]) => mockGetOrderForPayment(...args),
  validateTransferToken: (...args: unknown[]) => mockValidateToken(...args),
}));

jest.mock("@/lib/repositories", () => ({
  orderRepository: { findByOrderNumber: (...args: unknown[]) => mockFindByOrderNumber(...args) },
}));

jest.mock("@/lib/middleware", () => ({
  safeCheckRateLimit: () => ({ allowed: true, remaining: 9, resetAt: Date.now() + 60_000 }),
  getClientIp: () => "203.0.113.5",
}));

import { GET } from "@/app/api/orders/track/route";

function trackRequest(searchParams: Record<string, string>): {
  nextUrl: { searchParams: URLSearchParams };
} {
  return { nextUrl: { searchParams: new URLSearchParams(searchParams) } };
}

const ORDER_ROW = {
  id: "order-123456",
  order_number: "LZ-20260805-ABC123",
  customer_name: "Budi Test",
  buyer_discord_id: "123456789012345678",
  customer_discord: "123456789012345678",
  total: 111000,
  currency: "IDR",
  payment_method: "bank_transfer",
  status: "PENDING_PAYMENT",
  created_at: "2026-08-05T10:00:00.000Z",
};

describe("GET /api/orders/track", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCookiesGet.mockReturnValue(undefined);
    mockValidateToken.mockResolvedValue(false);
    mockGetOrderForPayment.mockResolvedValue(null);
    mockFindByOrderNumber.mockResolvedValue(null);
  });

  it("returns order data for orderId when the confirmation cookie is valid", async () => {
    mockCookiesGet.mockReturnValue({ value: "a".repeat(43) });
    mockValidateToken.mockResolvedValue(true);
    mockGetOrderForPayment.mockResolvedValue({ ...ORDER_ROW, items: [] });

    const response = await GET(trackRequest({ orderId: "order-123456" }) as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockValidateToken).toHaveBeenCalledWith("order-123456", "a".repeat(43));
    expect(mockGetOrderForPayment).toHaveBeenCalledWith("order-123456");
    expect(body.data.customer_name).toBe("Budi Test");
  });

  it("fails closed with 404 and no PII when the cookie is missing", async () => {
    const response = await GET(trackRequest({ orderId: "order-123456" }) as never);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(mockGetOrderForPayment).not.toHaveBeenCalled();
    expect(JSON.stringify(body)).not.toContain("Budi Test");
    expect(JSON.stringify(body)).not.toContain("123456789012345678");
  });

  it("fails closed with 404 when the cookie is present but invalid", async () => {
    mockCookiesGet.mockReturnValue({ value: "b".repeat(43) });
    mockValidateToken.mockResolvedValue(false);

    const response = await GET(trackRequest({ orderId: "order-123456" }) as never);

    expect(response.status).toBe(404);
    expect(mockGetOrderForPayment).not.toHaveBeenCalled();
    expect(mockValidateToken).toHaveBeenCalledWith("order-123456", "b".repeat(43));
  });

  it("accepts the token as a query param when no cookie is present (cross-device)", async () => {
    mockValidateToken.mockResolvedValue(true);
    mockGetOrderForPayment.mockResolvedValue({ ...ORDER_ROW, items: [] });

    const response = await GET(trackRequest({ orderId: "order-123456", token: "d".repeat(43) }) as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockValidateToken).toHaveBeenCalledWith("order-123456", "d".repeat(43));
    expect(mockGetOrderForPayment).toHaveBeenCalledWith("order-123456");
    expect(body.data.customer_name).toBe("Budi Test");
  });

  it("fails closed with 404 when the query token is invalid", async () => {
    mockValidateToken.mockResolvedValue(false);

    const response = await GET(trackRequest({ orderId: "order-123456", token: "e".repeat(43) }) as never);

    expect(response.status).toBe(404);
    expect(mockGetOrderForPayment).not.toHaveBeenCalled();
  });

  it("resolves the manual order-number path without any cookie (order number is the bearer credential)", async () => {
    mockFindByOrderNumber.mockResolvedValue({
      id: "order-1",
      orderNumber: "LZ-20260805-ABC123",
      status: "PENDING_PAYMENT",
      customerName: "Budi Test",
      customerDiscord: "123456789012345678",
      buyerDiscordId: "123456789012345678",
      subtotal: 100000,
      tax: 11000,
      total: 111000,
      currency: "IDR",
      paymentMethod: "bank_transfer",
      createdAt: "2026-08-05T10:00:00.000Z",
      items: [{ name: "Game Item", quantity: 1, price: 100000 }],
    });

    const response = await GET(trackRequest({ orderNumber: "LZ-20260805-ABC123" }) as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockCookiesGet).not.toHaveBeenCalled();
    expect(body.data.orderNumber).toBe("LZ-20260805-ABC123");
    // Contact identifiers AND the full name stay masked on the anonymous path.
    expect(body.data.customerName).toBe("Budi T.");
    expect(body.data.customerDiscord).toBeUndefined();
    expect(body.data.buyerDiscordId).toBeUndefined();
  });

  it("fails closed with 404 when the cookie is valid but the order does not exist", async () => {
    mockCookiesGet.mockReturnValue({ value: "c".repeat(43) });
    mockValidateToken.mockResolvedValue(false); // validateTransferToken is false for a missing order

    const response = await GET(trackRequest({ orderId: "order-123456" }) as never);

    expect(response.status).toBe(404);
    expect(mockGetOrderForPayment).not.toHaveBeenCalled();
  });

  it("rejects a malformed orderId", async () => {
    const response = await GET(trackRequest({ orderId: "a".repeat(7) }) as never);
    expect(response.status).toBe(400);
    expect(mockGetOrderForPayment).not.toHaveBeenCalled();
  });

  it("rejects a malformed orderNumber", async () => {
    const response = await GET(trackRequest({ orderNumber: "not-an-order" }) as never);
    expect(response.status).toBe(400);
    expect(mockFindByOrderNumber).not.toHaveBeenCalled();
  });
});
