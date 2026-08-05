const mockCookiesGet = jest.fn();
const mockValidateToken = jest.fn();
const mockConfirmTransfer = jest.fn();
const mockCookieSet = jest.fn();

class MockResponse {
  status: number;
  private body: unknown;
  cookies = { set: mockCookieSet };

  constructor(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
    this.body = body;
    this.status = init?.status || 200;
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

jest.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: mockCookiesGet }),
}));

jest.mock("@/lib/payment/payment-service", () => ({
  validateTransferToken: (...args: unknown[]) => mockValidateToken(...args),
  confirmTransfer: (...args: unknown[]) => mockConfirmTransfer(...args),
  getOrderForPayment: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/lib/middleware", () => ({
  addRateLimitHeaders: (response: Response) => response,
  checkRateLimit: () => ({ allowed: true, remaining: 4, resetAt: Date.now() + 1000 }),
  corsHeaders: () => ({ "Access-Control-Allow-Origin": "*" }),
  getClientIp: () => "127.0.0.1",
  handleCors: () => null,
}));

jest.mock("@/lib/repositories", () => ({
  orderRepository: { findById: jest.fn() },
}));

jest.mock("@/lib/discord/bot", () => ({ sendSellerNotification: jest.fn() }));
jest.mock("@/lib/payment/payment-proof-storage", () => ({
  createPaymentProofSignedUrl: jest.fn(),
  deletePaymentProof: jest.fn(),
  uploadPaymentProof: jest.fn(),
}));

import { POST } from "@/app/api/orders/[orderId]/confirm/route";

function formRequest(token?: string, queryToken?: string): {
  headers: Headers;
  formData: () => Promise<FormData>;
  nextUrl: { searchParams: URLSearchParams };
} {
  const form = new FormData();
  form.set("buyerName", "Test Customer");
  form.set("buyerDiscordId", "123456789012345678");
  form.set("note", "");
  if (token) form.set("confirmationToken", token);
  const searchParams = new URLSearchParams();
  if (queryToken) searchParams.set("token", queryToken);
  return {
    headers: new Headers({ "content-type": "multipart/form-data" }),
    formData: async () => form,
    nextUrl: { searchParams },
  };
}

describe("POST /api/orders/[orderId]/confirm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateToken.mockResolvedValue(true);
    mockConfirmTransfer.mockResolvedValue({ success: true });
    mockCookiesGet.mockReturnValue({ value: "a".repeat(43) });
  });

  it("uses the scoped cookie token", async () => {
    const response = await POST(formRequest() as never, { params: Promise.resolve({ orderId: "order-1" }) });

    expect(response.status).toBe(200);
    expect(mockValidateToken).toHaveBeenCalledWith("order-1", "a".repeat(43));
    expect(mockConfirmTransfer).toHaveBeenCalledWith(
      "order-1",
      "Test Customer",
      "123456789012345678",
      "",
      "a".repeat(43),
      undefined
    );
    // Confirming mirrors the token into the order-scoped cookie so the payment
    // page's track reads keep working on refresh/poll, including on devices
    // that never checked out (no cookie was issued there).
    expect(mockCookieSet).toHaveBeenCalledWith(expect.objectContaining({
      name: "payment_confirmation_order-1",
      value: "a".repeat(43),
      httpOnly: true,
      path: "/api/orders",
    }));
  });

  it("keeps body-token compatibility when the cookie is absent", async () => {
    mockCookiesGet.mockReturnValue(undefined);

    const response = await POST(formRequest("b".repeat(43)) as never, { params: Promise.resolve({ orderId: "order-1" }) });

    expect(response.status).toBe(200);
    expect(mockValidateToken).toHaveBeenCalledWith("order-1", "b".repeat(43));
    expect(mockCookieSet).toHaveBeenCalledWith(expect.objectContaining({
      name: "payment_confirmation_order-1",
      value: "b".repeat(43),
      path: "/api/orders",
    }));
  });

  it("does not accept a query-string token", async () => {
    mockCookiesGet.mockReturnValue(undefined);

    const response = await POST(formRequest(undefined, "query-token") as never, { params: Promise.resolve({ orderId: "order-1" }) });

    expect(response.status).toBe(400);
    expect(mockValidateToken).not.toHaveBeenCalled();
    expect(mockConfirmTransfer).not.toHaveBeenCalled();
  });
});
