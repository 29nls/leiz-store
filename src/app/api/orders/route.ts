import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-helpers";
import { successResponse, errorResponse, ValidationError } from "@/lib/errors";
import { orderService } from "@/lib/services";
import { corsHeaders, handleCors } from "@/lib/middleware";
import type { Currency } from "@/lib/currency";

export const POST = withErrorHandling(async (req: NextRequest) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const body = await req.json();
  const { customerName, customerEmail, customerDiscord, customerIGN, customerNotes, items, paymentMethod, currency } = body;

  if (!customerName || !items?.length || !paymentMethod) {
    return NextResponse.json(
      errorResponse(new ValidationError("customerName, items, and paymentMethod are required")),
      { status: 400, headers: corsHeaders() }
    );
  }

  const order = await orderService.create({
    customerName,
    customerEmail,
    customerDiscord,
    customerIGN,
    customerNotes,
    items,
    paymentMethod,
    currency: (currency || "IDR") as Currency,
  });

  return NextResponse.json(successResponse(order), {
    status: 201,
    headers: corsHeaders(),
  });
});
