/**
 * POST /api/orders/[orderId]/confirm
 * Buyer confirms they have made a transfer
 */

import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-helpers";
import { successResponse, errorResponse, ValidationError } from "@/lib/errors";
import { addRateLimitHeaders, checkRateLimit, corsHeaders, getClientIp, handleCors } from "@/lib/middleware";
import { confirmTransferSchema } from "@/lib/validators/order";
import { confirmTransfer, getOrderForPayment, validateTransferToken } from "@/lib/payment/payment-service";
import { orderRepository } from "@/lib/repositories";
import { cookies } from "next/headers";
import { paymentConfirmationCookieName } from "@/lib/order-idempotency";
import { sendSellerNotification } from "@/lib/discord/bot";
import {
  createPaymentProofSignedUrl,
  deletePaymentProof,
  uploadPaymentProof,
} from "@/lib/payment/payment-proof-storage";

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

  const rateLimit = checkRateLimit(`confirm:${getClientIp(req)}:${orderId}`, 5, 10 * 60 * 1000);
  if (!rateLimit.allowed) {
    const response = NextResponse.json(
      errorResponse(new ValidationError("Too many confirmation attempts. Please try again later.")),
      { status: 429, headers: corsHeaders(req.headers.get("origin") || undefined) }
    );
    return addRateLimitHeaders(response, rateLimit, 5);
  }

  const contentType = req.headers.get("content-type") || "";
  let buyerName: unknown;
  let buyerDiscordId: unknown;
  let confirmationToken: unknown;
  let note: unknown;
  let proofFile: File | null = null;

  if (contentType.toLowerCase().includes("multipart/form-data")) {
    const formData = await req.formData();
    buyerName = formData.get("buyerName");
    buyerDiscordId = formData.get("buyerDiscordId");
    confirmationToken = formData.get("confirmationToken");
    note = formData.get("note");
    const candidate = formData.get("paymentProof");
    proofFile = candidate instanceof File ? candidate : null;
  } else {
    const body = await req.json();
    buyerName = body?.buyerName;
    buyerDiscordId = body?.buyerDiscordId;
    confirmationToken = body?.confirmationToken;
    note = body?.note;
    if (body?.paymentProofBase64) {
      return NextResponse.json(
        errorResponse(new ValidationError("Payment proof must be uploaded as multipart/form-data")),
        { status: 400, headers: corsHeaders() }
      );
    }
  }

  const cookieToken = (await cookies()).get(paymentConfirmationCookieName(orderId))?.value;
  const resolvedConfirmationToken = cookieToken || confirmationToken;
  const parsed = confirmTransferSchema.safeParse({
    buyerName,
    buyerDiscordId,
    confirmationToken: resolvedConfirmationToken,
    note,
  });
  if (!parsed.success) {
    const message = parsed.error.issues.map((e: { message: string }) => e.message).join(", ");
    return NextResponse.json(
      errorResponse(new ValidationError(message)),
      { status: 400, headers: corsHeaders() }
    );
  }

  const token = parsed.data.confirmationToken;
  if (!token) {
    return NextResponse.json(
      errorResponse(new ValidationError("Confirmation token is required.")),
      { status: 400, headers: corsHeaders() }
    );
  }

  let proofPath: string | null = null;
  try {
    if (!(await validateTransferToken(orderId, token))) {
      return NextResponse.json(
        errorResponse(new ValidationError("Invalid payment confirmation token")),
        { status: 401, headers: corsHeaders(req.headers.get("origin") || undefined) }
      );
    }
    if (proofFile) proofPath = await uploadPaymentProof(proofFile, orderId);

    const result = await confirmTransfer(
      orderId,
      parsed.data.buyerName,
      parsed.data.buyerDiscordId,
      parsed.data.note,
      token,
      proofPath || undefined
    );

    if (!result.success) {
      if (proofPath) await deletePaymentProof(proofPath);
      return NextResponse.json(
        errorResponse(new ValidationError(result.error || "Confirmation failed")),
        { status: 400, headers: corsHeaders() }
      );
    }

    try {
      const orderData = await getOrderForPayment(orderId);
      if (orderData) {
        const hasItems =
          (orderData as any).items?.length ||
          (orderData as any).orderItem?.length ||
          (orderData as any).order_item?.length;

        if (!hasItems) {
          const fullOrder = (await orderRepository.findById(orderId)) as any;
          const fallbackItems = fullOrder?.items || fullOrder?.orderItem || fullOrder?.order_item || [];
          if (fallbackItems?.length) {
            (orderData as any).items = fallbackItems;
            (orderData as any).orderItem = fallbackItems;
            (orderData as any).order_item = fallbackItems;
          }
        }

        if (proofPath) {
          (orderData as any).paymentProofUrl = await createPaymentProofSignedUrl(proofPath);
        }
        await sendSellerNotification(orderData);
      }
    } catch (err) {
      console.error("[ConfirmTransfer] Discord notification failed:", err);
    }

    const response = NextResponse.json(
      successResponse({ message: "Transfer confirmed", orderId }),
      { status: 200, headers: corsHeaders(req.headers.get("origin") || undefined) }
    );
    // The confirmation cookie is intentionally NOT cleared here: the payment
    // page keeps polling GET /api/orders/track?orderId=… after confirming, so
    // a refresh must still be authorized. The token is order-scoped and expires
    // with the order (PAYMENT_EXPIRY_MS); confirm is idempotent and guarded by
    // status + duplicate checks, so keeping it grants read access only.
    return addRateLimitHeaders(response, rateLimit, 5);
  } catch (error) {
    if (proofPath) await deletePaymentProof(proofPath);
    throw error;
  }
});