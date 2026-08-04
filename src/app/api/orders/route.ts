import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-helpers";
import { successResponse, errorResponse, ValidationError } from "@/lib/errors";
import { orderService } from "@/lib/services";
import { corsHeaders, handleCors } from "@/lib/middleware";
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

  const { customerName, customerDiscord, customerIGN, customerNotes, items, paymentMethod, currency } = parsed.data;

  const result = await orderService.create({
    customerName,
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
    path: `/api/orders/${String((result.order as any).id)}/confirm`,
    maxAge: Math.floor(PAYMENT_EXPIRY_MS / 1000),
  });

  return response;
});
