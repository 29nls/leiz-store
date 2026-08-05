import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-helpers";
import { successResponse, errorResponse, ValidationError, AppError } from "@/lib/errors";
import { orderService } from "@/lib/services";
import { corsHeaders, handleCors, getClientIp, safeCheckRateLimit, ORDER_CREATE_RATE_LIMIT } from "@/lib/middleware";
import type { Currency } from "@/lib/currency";
import { createOrderSchema } from "@/lib/validators/order";
import { paymentConfirmationCookieName, validateIdempotencyKey } from "@/lib/order-idempotency";
import { PAYMENT_EXPIRY_MS } from "@/lib/payment/constants";


export const POST = withErrorHandling(async (
  req: NextRequest,
  _context: { params: Promise<Record<string, string>> }
) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Rate limit order creation per client (generous cap; fail-open). Stops
  // scripted flooding while a legitimate buyer (even behind a shared NAT IP)
  // is unaffected. See ORDER_CREATE_RATE_LIMIT in src/lib/middleware.ts.
  const rateLimit = await safeCheckRateLimit(
    `order-create:${getClientIp(req)}`,
    ORDER_CREATE_RATE_LIMIT.max,
    ORDER_CREATE_RATE_LIMIT.windowMs
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      errorResponse(new AppError(429, "RATE_LIMITED", "Too many orders. Please try again later.")),
      { status: 429, headers: corsHeaders() }
    );
  }

  const body = await req.json();

  // Validate with zod
  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const message = Object.entries(fieldErrors)
      .map(([field, errors]) => `${field}: ${(errors || []).join(", ")}`)
      .join("; ");
    console.error("[Order Validation Failed]", message);
    return NextResponse.json(
      errorResponse(new ValidationError(message || "Validation failed")),
      { status: 400, headers: corsHeaders() }
    );
  }

  const rawIdempotencyKey = req.headers.get("Idempotency-Key");
  const idempotencyKey = validateIdempotencyKey(rawIdempotencyKey);
  if (rawIdempotencyKey !== null && !idempotencyKey) {
    return NextResponse.json(
      errorResponse(new ValidationError("Invalid Idempotency-Key header")),
      { status: 400, headers: corsHeaders() }
    );
  }

  const { customerName, customerEmail, customerDiscord, customerIGN, customerNotes, items, paymentMethod, currency } = parsed.data;

  const result = await orderService.create({
    customerName,
    customerEmail: customerEmail || undefined,
    customerDiscord: customerDiscord || undefined,
    customerIGN: customerIGN || undefined,
    customerNotes: customerNotes || undefined,
    items,
    paymentMethod,
    currency: (currency || "IDR") as Currency,
  }, { idempotencyKey: idempotencyKey || undefined });

  const {
    paymentConfirmationTokenHash: _paymentConfirmationTokenHash,
    payment_confirmation_token_hash: _paymentConfirmationTokenHashSnake,
    ...safeOrder
  } = result.order as Record<string, unknown>;
  void _paymentConfirmationTokenHash;
  void _paymentConfirmationTokenHashSnake;

  const response = NextResponse.json(successResponse({
    ...safeOrder,
    manualPayment: result.manualPayment,
    replayed: result.replayed,
    // Order-scoped bearer token, also mirrored in the HttpOnly cookie below.
    // Exposing it lets the checkout page carry it on the payment URL so
    // confirmation/tracking still work on a fresh device (cross-device,
    // incognito, or cleared cookies). It is unguessable, expires with the
    // order, and only authorizes this one order.
    paymentConfirmationToken: result.paymentConfirmationToken,
  }), {
    status: 201,
    headers: corsHeaders(),
  });

  response.cookies.set({
    name: paymentConfirmationCookieName(String((result.order as any).id)),
    value: result.paymentConfirmationToken,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    // MED-1: broadened from /api/orders/{id}/confirm so the same token also
    // authorizes GET /api/orders/track?orderId=… reads (the payment page's
    // track fetch is same-origin and carries this cookie). Still httpOnly +
    // SameSite=Lax, and scoped per-order via the cookie name.
    path: "/api/orders",
    maxAge: Math.floor(PAYMENT_EXPIRY_MS / 1000),
  });

  return response;
});
