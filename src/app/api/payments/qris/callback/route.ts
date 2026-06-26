import { NextRequest } from "next/server";
import { handleQRISCallback } from "@/lib/qris";
import { prisma } from "@/lib/db";
import { successResponse, errorResponse } from "@/lib/errors";
import { checkRateLimit } from "@/lib/middleware";
import { OrderStatus, PaymentStatus } from "@/lib/prisma-types";

export async function POST(request: NextRequest) {
  try {
    // Rate limit webhook callbacks
    const clientIp = request.headers.get("x-forwarded-for") || "unknown";
    const rateLimit = checkRateLimit(`qris-webhook:${clientIp}`, 30, 60000);
    if (!rateLimit.allowed) {
      return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    // Verify webhook signature if configured
    const webhookSecret = process.env.QRIS_WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature = request.headers.get("x-qr-signature") || request.headers.get("x-webhook-signature");
      if (!signature || signature !== webhookSecret) {
        return Response.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const body = await request.json();
    const result = await handleQRISCallback(body);

    if (result.status === "SUCCESS") {
      const order = await prisma.order.findUnique({
        where: { orderNumber: result.orderNumber },
        include: { payment: true },
      });

      if (order) {
        await prisma.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.PAID, paidAt: new Date() },
        });

        if (order.payment) {
          await prisma.payment.update({
            where: { id: order.payment.id },
            data: { status: PaymentStatus.VERIFIED, verifiedAt: new Date(), paidAt: new Date() },
          });
        }
      }
    }

    return Response.json(successResponse(result));
  } catch (error) {
    return Response.json(errorResponse(error as any), {
      status: (error as any).statusCode || 500,
    });
  }
}
