/**
 * POST /api/admin/payment-action
 * Admin payment verification actions (called from Discord bot or admin panel)
 * Protected by DISCORD_ADMIN_SECRET header
 */

import { NextRequest, NextResponse } from "next/server";
import { successResponse, errorResponse, ValidationError } from "@/lib/errors";
import { corsHeaders } from "@/lib/middleware";
import { adminPaymentActionSchema } from "@/lib/validators/order";
import {
  adminAcceptPayment,
  adminRejectPayment,
  adminCancelOrder,
  adminForceCancelOrder,
  getOrderForPayment,
} from "@/lib/payment/payment-service";
import { sendBuyerNotification } from "@/lib/discord/bot";

function verifyAdminSecret(req: NextRequest): boolean {
  const secret = process.env.DISCORD_ADMIN_SECRET;
  if (!secret) {
    console.warn("[PaymentAction] DISCORD_ADMIN_SECRET not configured");
    return false;
  }
  const provided = req.headers.get("x-admin-secret") || req.headers.get("authorization")?.replace("Bearer ", "");
  return provided === secret;
}

export async function POST(req: NextRequest) {
  // Verify admin secret
  if (!verifyAdminSecret(req)) {
    return NextResponse.json(
      errorResponse(new ValidationError("Unauthorized")),
      { status: 401, headers: corsHeaders() }
    );
  }

  try {
    const body = await req.json();
    const parsed = adminPaymentActionSchema.safeParse(body);

    if (!parsed.success) {
      const message = parsed.error.issues.map((e: { message: string }) => e.message).join(", ");
      return NextResponse.json(
        errorResponse(new ValidationError(message)),
        { status: 400, headers: corsHeaders() }
      );
    }

    const { orderId, action, adminId } = parsed.data;

    let result: { success: boolean; error?: string; order?: any };

    switch (action) {
      case "accept":
        result = await adminAcceptPayment(orderId, adminId);
        break;
      case "reject":
        result = await adminRejectPayment(orderId, adminId);
        break;
      case "cancel":
        result = await adminCancelOrder(orderId, adminId);
        break;
      case "force_cancel":
        result = await adminForceCancelOrder(orderId, adminId);
        break;
      default:
        return NextResponse.json(
          errorResponse(new ValidationError("Invalid action")),
          { status: 400, headers: corsHeaders() }
        );
    }

    if (!result.success) {
      return NextResponse.json(
        errorResponse(new ValidationError(result.error || "Action failed")),
        { status: 400, headers: corsHeaders() }
      );
    }

    // Send notification to buyer via Discord DM
    try {
      const orderData = await getOrderForPayment(orderId);
      if (orderData) {
        const statusMessages: Record<string, string> = {
          accept: "✅ Pembayaran Anda telah diverifikasi! Pesanan sedang diproses.",
          reject: "⚠️ Pembayaran Anda belum terdeteksi. Silakan periksa kembali dan hubungi admin.",
          cancel: "❌ Pesanan Anda telah dibatalkan.",
          force_cancel: "❌ Pesanan Anda telah dibatalkan oleh admin.",
        };

        await sendBuyerNotification(
          orderData.buyer_discord_id || orderData.customer_discord,
          orderData.order_number,
          statusMessages[action] || "Status pesanan Anda telah diperbarui."
        );
      }
    } catch (err) {
      console.error("[PaymentAction] Buyer notification failed:", err);
    }

    return NextResponse.json(
      successResponse({ message: `Action '${action}' completed`, orderId }),
      { status: 200, headers: corsHeaders() }
    );
  } catch (error) {
    console.error("[PaymentAction] Error:", error);
    return NextResponse.json(
      errorResponse(new ValidationError("Internal server error")),
      { status: 500, headers: corsHeaders() }
    );
  }
}
