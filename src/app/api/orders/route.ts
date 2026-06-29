import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-helpers";
import { successResponse, errorResponse, ValidationError } from "@/lib/errors";
import { orderService } from "@/lib/services";
import { corsHeaders, handleCors } from "@/lib/middleware";
import type { Currency } from "@/lib/currency";
import { createOrderSchema } from "@/lib/validators/order";


export const POST = withErrorHandling(async (req: NextRequest) => {
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

  const { customerName, customerEmail, customerDiscord, customerIGN, customerNotes, items, paymentMethod, currency } = parsed.data;

  // Discord ID is required for all manual payment methods
  if (!customerDiscord) {
    console.error("[Order Validation Failed] Discord ID is missing but required");
    return NextResponse.json(
      errorResponse(new ValidationError("Discord ID is required for payment notification")),
      { status: 400, headers: corsHeaders() }
    );
  }

  const order = await orderService.create({
    customerName,
    customerEmail: customerEmail || undefined,
    customerDiscord: customerDiscord || undefined,
    customerIGN: customerIGN || undefined,
    customerNotes: customerNotes || undefined,
    items,
    paymentMethod,
    currency: (currency || "IDR") as Currency,
  });

  return NextResponse.json(successResponse(order), {
    status: 201,
    headers: corsHeaders(),
  });
});
