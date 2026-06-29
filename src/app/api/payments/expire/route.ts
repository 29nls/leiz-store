/**
 * POST /api/payments/expire
 * Cron endpoint to expire overdue orders
 * Protected by CRON_SECRET header
 */

import { NextRequest, NextResponse } from "next/server";
import { successResponse, errorResponse, ValidationError } from "@/lib/errors";
import { expireOverdueOrders } from "@/lib/payment/payment-service";

export async function POST(req: NextRequest) {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const provided =
      req.headers.get("x-cron-secret") ||
      req.headers.get("authorization")?.replace("Bearer ", "");
    if (provided !== cronSecret) {
      return NextResponse.json(
        errorResponse(new ValidationError("Unauthorized")),
        { status: 401 }
      );
    }
  }

  try {
    const result = await expireOverdueOrders();

    return NextResponse.json(
      successResponse({
        message: `Expired ${result.expired} orders`,
        expired: result.expired,
        errors: result.errors,
      })
    );
  } catch (error) {
    console.error("[PaymentExpire] Error:", error);
    return NextResponse.json(
      errorResponse(new ValidationError("Failed to expire orders")),
      { status: 500 }
    );
  }
}
