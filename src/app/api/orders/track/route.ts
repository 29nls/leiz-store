import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { orderRepository } from "@/lib/repositories";
import { successResponse, errorResponse } from "@/lib/errors";
import { checkRateLimit, getClientIp } from "@/lib/middleware";
import { getOrderForPayment, validateTransferToken } from "@/lib/payment/payment-service";
import { paymentConfirmationCookieName } from "@/lib/order-idempotency";

/** Mask a full name to "First L." for anonymous lookups (no PII). */
function maskCustomerName(name: string | null | undefined): string {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) return "";
  const parts = trimmed.split(/\s+/);
  const first = parts[0];
  const initial = parts.length > 1 ? parts[1][0] : "";
  return initial ? `${first} ${initial.toUpperCase()}.` : first;
}

export async function GET(request: NextRequest) {
  try {
    // Rate limit public tracking endpoint
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`track:${clientIp}`, 10, 60000);
    if (!rateLimit.allowed) {
      return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const orderNumber = request.nextUrl.searchParams.get("orderNumber");
    const orderId = request.nextUrl.searchParams.get("orderId");

    if (orderId && !/^[a-zA-Z0-9_-]{8,64}$/.test(orderId)) {
      return Response.json(errorResponse(new Error("Invalid orderId") as any), { status: 400 });
    }
    if (orderNumber && !/^LZ-[0-9]{8}-[A-Z0-9]{6}$/i.test(orderNumber)) {
      return Response.json(errorResponse(new Error("Invalid orderNumber") as any), { status: 400 });
    }

    if (!orderNumber && !orderId) {
      return Response.json(
        errorResponse(new Error("orderNumber or orderId is required") as any),
        { status: 400 }
      );
    }

    // If orderId is provided, use the payment service for richer data.
    // The orderId branch returns buyer PII (customer name + Discord ID), so it
    // is gated on the order-scoped confirmation cookie that checkout issued
    // (broadened to path /api/orders so this endpoint receives it). A missing
    // or invalid cookie fails closed with the same generic 404 as a missing
    // order — no PII, and no way to probe whether an order exists.
    if (orderId) {
      const cookieToken = (await cookies()).get(paymentConfirmationCookieName(orderId))?.value;
      if (!cookieToken || !(await validateTransferToken(orderId, cookieToken))) {
        return Response.json(
          errorResponse(new Error("Order not found") as any),
          { status: 404 }
        );
      }

      const orderData = await getOrderForPayment(orderId);
      if (!orderData) {
        return Response.json(
          errorResponse(new Error("Order not found") as any),
          { status: 404 }
        );
      }

      // Public payment lookup uses an explicit allowlist. Never pass through
      // private order fields (email, notes, payment references, proof paths,
      // token hashes, or internal timestamps) by accident.
      const raw = orderData as Record<string, any>;
      const safeOrderData = {
        id: raw.id,
        order_number: raw.order_number,
        customer_name: raw.customer_name,
        buyer_discord_id: raw.buyer_discord_id,
        customer_discord: raw.customer_discord,
        total: raw.total,
        currency: raw.currency,
        payment_method: raw.payment_method,
        status: raw.status,
        expiry_at: raw.expiry_at,
        confirmed_at: raw.confirmed_at,
        created_at: raw.created_at,
        order_item: raw.order_item,
        items: raw.items,
        orderItem: raw.orderItem,
      };
      return Response.json(successResponse(safeOrderData));
    }

    // Otherwise use orderNumber lookup. The order number is itself the bearer
    // credential here — it is a random, unguessable per-order identifier the
    // buyer holds (from the Discord DM / checkout), never emailed. The response
    // intentionally masks contact identifiers (customerDiscord/buyerDiscordId).
    const order = await orderRepository.findByOrderNumber(orderNumber!);
    if (!order) {
      return Response.json(
        errorResponse(new Error("Order not found") as any),
        { status: 404 }
      );
    }

    const payment = (order as any).payment;
    const trackingInfo = {
      id: (order as any).id,
      orderNumber: order.orderNumber,
      status: order.status,
      // The order number is the bearer credential on this anonymous path, but
      // the buyer's full name is still PII — mask it to first name + initial
      // (the track page never renders it, so legit users are unaffected).
      customerName: maskCustomerName(order.customerName),
      // Do not expose contact identifiers through a public tracking lookup.
      customerDiscord: undefined,
      buyerDiscordId: undefined,
      items: order.items.map((item: any) => ({
        name: item.name,
        quantity: item.quantity,
        price: Number(item.price),
        total: Number(item.price) * Number(item.quantity),
      })),
      subtotal: order.subtotal,
      tax: order.tax,
      total: order.total,
      currency: order.currency,
      paymentMethod: order.paymentMethod,
      payment: payment
        ? {
            method: payment.method,
            status: payment.status || (order.status === "PAID" || order.status === "COMPLETED" ? "paid" : payment.status),
            paidAt: payment.paidAt,
          }
        : {
            method: order.paymentMethod || "",
            status: order.status === "COMPLETED" || order.status === "PAID" ? "paid" : order.status === "PROCESSING" ? "paid" : "pending",
            paidAt: null,
          },
      expiryAt: (order as any).expiryAt,
      confirmedAt: (order as any).confirmedAt,
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

