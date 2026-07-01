/**
 * POST /api/orders/[orderId]/confirm
 * Buyer confirms they have made a transfer
 */

import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-helpers";
import { successResponse, errorResponse, ValidationError } from "@/lib/errors";
import { corsHeaders, handleCors } from "@/lib/middleware";
import { confirmTransferSchema } from "@/lib/validators/order";
import { confirmTransfer, getOrderForPayment } from "@/lib/payment/payment-service";
import { orderRepository } from "@/lib/repositories";
import { sendSellerNotification } from "@/lib/discord/bot";

export const POST = withErrorHandling(async (
  req: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const params = context?.params ? await context.params : {};
  const orderId = params.orderId;

  if (!orderId) {
    return NextResponse.json(
      errorResponse(new ValidationError("orderId is required")),
      { status: 400, headers: corsHeaders() }
    );
  }

  const body = await req.json();
  const parsed = confirmTransferSchema.safeParse(body);

  if (!parsed.success) {
    const message = parsed.error.issues.map((e: { message: string }) => e.message).join(", ");
    return NextResponse.json(
      errorResponse(new ValidationError(message)),
      { status: 400, headers: corsHeaders() }
    );
  }

  const { buyerName, buyerDiscordId, note, paymentProofBase64 } = parsed.data;

  const result = await confirmTransfer(orderId, buyerName, buyerDiscordId, note);

  if (!result.success) {
    return NextResponse.json(
      errorResponse(new ValidationError(result.error || "Confirmation failed")),
      { status: 400, headers: corsHeaders() }
    );
  }

  // Send Discord notification to seller channel (fire-and-forget)
  try {
    const orderData = await getOrderForPayment(orderId);
    if (orderData) {
      // `getOrderForPayment` doesn't reliably include order items — that's
      // what caused the "📦 Produk" field in the Discord embed to fall back
      // to "—". Backfill items from the repository (which does include them,
      // with product data joined) whenever they're missing, so the
      // notification always has real product data. This is a no-op if
      // orderData already has items.
      const hasItems =
        (orderData as any).items?.length ||
        (orderData as any).orderItem?.length ||
        (orderData as any).order_item?.length;

      if (!hasItems) {
        const fullOrder = (await orderRepository.findById(orderId)) as any;
        if (fullOrder?.items?.length) {
          (orderData as any).items = fullOrder.items;
        }
      }

      if (paymentProofBase64) {
        (orderData as any).paymentProofBase64 = paymentProofBase64;
      }
      await sendSellerNotification(orderData);
    }
  } catch (err) {
    console.error("[ConfirmTransfer] Discord notification failed:", err);
    // Don't fail the request if notification fails
  }

  return NextResponse.json(
    successResponse({ message: "Transfer confirmed", orderId }),
    { status: 200, headers: corsHeaders() }
  );
});