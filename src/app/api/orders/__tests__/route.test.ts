const mockSet = jest.fn();
const mockOrderCreate = jest.fn();

class MockResponse {
  status: number;
  private body: unknown;
  headers: Map<string, string>;
  cookies = { set: mockSet };

  constructor(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
    this.body = body;
    this.status = init?.status || 200;
    this.headers = new Map(Object.entries(init?.headers || {}));
  }

  async json() { return this.body; }
}

jest.mock("next/server", () => ({
  NextResponse: {
    json(data: unknown, init?: { status?: number; headers?: Record<string, string> }) {
      return new MockResponse(data, init);
    },
  },
}));

jest.mock("@/lib/services", () => ({
  orderService: {
    create: (...args: unknown[]) => mockOrderCreate(...args),
  },
}));

jest.mock("@/lib/middleware", () => ({
  corsHeaders: () => ({ "Access-Control-Allow-Origin": "*" }),
  handleCors: () => null,
}));

import { POST } from "@/app/api/orders/route";

function request(body: unknown, idempotencyKey?: string): { headers: Headers; json: () => Promise<unknown> } {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (idempotencyKey !== undefined) headers.set("Idempotency-Key", idempotencyKey);
  return {
    headers,
    json: async () => body,
  };
}

const body = {
  customerName: "Test Customer",
  customerDiscord: "123456789012345678",
  items: [{ productId: "p1", quantity: 1 }],
  paymentMethod: "bank_transfer",
  currency: "IDR",
};

describe("POST /api/orders", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOrderCreate.mockResolvedValue({
      order: {
        id: "order-1",
        orderNumber: "LZ-20260805-ABC123",
        status: "PENDING_PAYMENT",
        paymentConfirmationTokenHash: "private-hash",
        payment_confirmation_token_hash: "private-snake-hash",
      },
      manualPayment: true,
      replayed: false,
      paymentConfirmationToken: "raw-token-value",
    });
  });

  it("accepts an optional valid idempotency key and sets a scoped HttpOnly cookie", async () => {
    const key = "550e8400-e29b-41d4-a716-446655440000";
    const response = await POST(request(body, key) as never, { params: Promise.resolve({}) });
    const payload = await response.json() as { data: Record<string, unknown> };

    expect(response.status).toBe(201);
    expect(mockOrderCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customerName: "Test Customer" }),
      { idempotencyKey: key }
    );
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
      name: "payment_confirmation_order-1",
      value: "raw-token-value",
      httpOnly: true,
      sameSite: "lax",
      path: "/api/orders/order-1/confirm",
    }));
    expect(payload.data.paymentConfirmationToken).toBeUndefined();
    expect(payload.data.paymentConfirmationTokenHash).toBeUndefined();
    expect(payload.data.payment_confirmation_token_hash).toBeUndefined();
  });

  it("supports requests without an idempotency key", async () => {
    const response = await POST(request(body) as never, { params: Promise.resolve({}) });

    expect(response.status).toBe(201);
    expect(mockOrderCreate).toHaveBeenCalledWith(
      expect.any(Object),
      { idempotencyKey: undefined }
    );
  });

  it("rejects a present but malformed idempotency key", async () => {
    const response = await POST(request(body, "not-a-uuid") as never, { params: Promise.resolve({}) });

    expect(response.status).toBe(400);
    expect(mockOrderCreate).not.toHaveBeenCalled();
  });
});
