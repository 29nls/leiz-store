import { NextRequest } from "next/server";
import { orderRepository } from "@/lib/repositories";
import { successResponse, errorResponse } from "@/lib/errors";
import { checkRateLimit } from "@/lib/middleware";

export async function GET(request: NextRequest) {
  try {
    // Rate limit public tracking endpoint
    const clientIp = request.headers.get("x-forwarded-for") || "unknown";
    const rateLimit = checkRateLimit(`track:${clientIp}`, 20, 60000);
    if (!rateLimit.allowed) {
      return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const orderNumber = request.nextUrl.searchParams.get("orderNumber");

    if (!orderNumber) {
      return Response.json(
        errorResponse(new Error("orderNumber is required") as any),
        { status: 400 }
      );
    }

    const order = await orderRepository.findByOrderNumber(orderNumber);
    if (!order) {
      return Response.json(
        errorResponse(new Error("Order not found") as any),
        { status: 404 }
      );
    }

    const trackingInfo = {
      orderNumber: order.orderNumber,
      status: order.status,
      customerName: order.customerName,
      items: order.items.map((item: any) => ({
        name: item.name,
        quantity: item.quantity,
        price: Number(item.price),
      })),
      subtotal: order.subtotal,
      tax: order.tax,
      total: order.total,
      currency: order.currency,
      paymentMethod: order.paymentMethod,
      statusHistory: [
        { status: "PENDING", date: order.createdAt },
        ...(order.paidAt ? [{ status: "PAID", date: order.paidAt }] : []),
        ...(order.completedAt ? [{ status: "COMPLETED", date: order.completedAt }] : []),
      ],
      createdAt: order.createdAt,
    };

    return Response.json(successResponse(trackingInfo));
  } catch (error) {
    return Response.json(errorResponse(error as any), {
      status: (error as any).statusCode || 500,
    });
  }
}
