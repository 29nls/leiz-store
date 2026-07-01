/**
 * Payment Service
 * Business logic for manual payment flow
 * All operations use supabaseAdmin (server-side, bypasses RLS)
 */

import { supabaseAdmin } from "@/lib/supabase";
import { isValidTransition } from "@/lib/payment/constants";
import { logOrderStatusChange, type ActorType } from "@/lib/payment/order-logger";
import { OrderStatus } from "@/lib/prisma-types";

// ─── Helper: fetch order by ID ──────────────────────────────

async function getOrder(orderId: string) {
  const { data, error } = await supabaseAdmin
    .from("order")
    .select("*")
    .eq("id", orderId)
    .single();

  if (error || !data) return null;
  return data;
}

// ─── Helper: update order status with validation ────────────

async function updateOrderStatus(
  orderId: string,
  newStatus: string,
  actorType: ActorType,
  actorId: string | undefined,
  action: string,
  extraFields: Record<string, unknown> = {}
): Promise<{ success: boolean; error?: string; order?: any }> {
  const order = await getOrder(orderId);
  if (!order) {
    return { success: false, error: "Order not found" };
  }

  const currentStatus = order.status;

  if (!isValidTransition(currentStatus, newStatus)) {
    return {
      success: false,
      error: `Invalid transition from ${currentStatus} to ${newStatus}`,
    };
  }

  const updateData: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
    ...extraFields,
  };

  const { data: updated, error } = await supabaseAdmin
    .from("order")
    .update(updateData)
    .eq("id", orderId)
    .select("*")
    .single();

  if (error) {
    console.error("[PaymentService] Update failed:", error.message);
    return { success: false, error: "Failed to update order" };
  }

  // Log the status change
  await logOrderStatusChange({
    orderId,
    actorType,
    actorId,
    action,
    previousStatus: currentStatus,
    newStatus,
  });

  return { success: true, order: updated };
}

// ─── Buyer: Confirm Transfer ────────────────────────────────

export async function confirmTransfer(
  orderId: string,
  buyerName: string,
  buyerDiscordId?: string,
  note?: string
): Promise<{ success: boolean; error?: string; order?: any }> {
  const order = await getOrder(orderId);
  if (!order) {
    return { success: false, error: "Order not found" };
  }

  // Check status
  if (order.status !== OrderStatus.PENDING_PAYMENT) {
    return {
      success: false,
      error: `Order is not awaiting payment (current: ${order.status})`,
    };
  }

  // Check expiry
  if (order.expiry_at && new Date(order.expiry_at) < new Date()) {
    // Auto-expire
    await updateOrderStatus(orderId, OrderStatus.EXPIRED, "SYSTEM", undefined, "AUTO_EXPIRE");
    return { success: false, error: "Order has expired" };
  }

  // Check for duplicate confirmation
  const { data: existing } = await supabaseAdmin
    .from("payment_confirmation")
    .select("id")
    .eq("order_id", orderId)
    .single();

  if (existing) {
    return { success: false, error: "Transfer already confirmed for this order" };
  }

  // Create confirmation record
  const { error: confirmError } = await supabaseAdmin
    .from("payment_confirmation")
    .insert({
      order_id: orderId,
      buyer_name: buyerName,
      buyer_discord_id: buyerDiscordId || null,
      note: note || null,
    });

  if (confirmError) {
    console.error("[PaymentService] Confirmation insert failed:", confirmError.message);
    return { success: false, error: "Failed to create confirmation" };
  }

  // Update order status
  const result = await updateOrderStatus(
    orderId,
    OrderStatus.WAITING_CONFIRMATION,
    "BUYER",
    buyerDiscordId || buyerName,
    "CONFIRM_TRANSFER",
    { confirmed_at: new Date().toISOString() }
  );

  return result;
}

// ─── Admin: Accept Payment ──────────────────────────────────

export async function adminAcceptPayment(
  orderId: string,
  adminId: string
): Promise<{ success: boolean; error?: string; order?: any }> {
  return updateOrderStatus(
    orderId,
    OrderStatus.PAID,
    "ADMIN",
    adminId,
    "PAYMENT_ACCEPTED",
    { paid_at: new Date().toISOString() }
  );
}

// ─── Admin: Reject Payment ──────────────────────────────────

export async function adminRejectPayment(
  orderId: string,
  adminId: string
): Promise<{ success: boolean; error?: string; order?: any }> {
  return updateOrderStatus(
    orderId,
    OrderStatus.NEEDS_REVIEW,
    "ADMIN",
    adminId,
    "PAYMENT_REJECTED"
  );
}

// ─── Admin: Cancel Order ────────────────────────────────────

export async function adminCancelOrder(
  orderId: string,
  adminId: string
): Promise<{ success: boolean; error?: string; order?: any }> {
  return updateOrderStatus(
    orderId,
    OrderStatus.CANCELLED,
    "ADMIN",
    adminId,
    "ORDER_CANCELLED",
    { cancelled_at: new Date().toISOString() }
  );
}

// ─── Admin: Force Cancel Order ──────────────────────────────

export async function adminForceCancelOrder(
  orderId: string,
  adminId: string
): Promise<{ success: boolean; error?: string; order?: any }> {
  return updateOrderStatus(
    orderId,
    OrderStatus.FORCE_CANCELLED,
    "ADMIN",
    adminId,
    "ORDER_FORCE_CANCELLED",
    { cancelled_at: new Date().toISOString() }
  );
}

// ─── System: Expire Overdue Orders ──────────────────────────

export async function expireOverdueOrders(): Promise<{
  expired: number;
  errors: string[];
}> {
  const now = new Date().toISOString();

  // Find orders that have passed their expiry_at and are still in payable states
  const { data: overdueOrders, error } = await supabaseAdmin
    .from("order")
    .select("id, order_number, status, buyer_discord_id")
    .in("status", [OrderStatus.PENDING_PAYMENT, OrderStatus.WAITING_CONFIRMATION])
    .lt("expiry_at", now);

  if (error || !overdueOrders) {
    console.error("[PaymentService] Failed to fetch overdue orders:", error?.message);
    return { expired: 0, errors: [error?.message || "Query failed"] };
  }

  let expired = 0;
  const errors: string[] = [];

  for (const order of overdueOrders) {
    const result = await updateOrderStatus(
      order.id,
      OrderStatus.EXPIRED,
      "SYSTEM",
      undefined,
      "AUTO_EXPIRE"
    );

    if (result.success) {
      expired++;
    } else {
      errors.push(`Failed to expire ${order.order_number}: ${result.error}`);
    }
  }

  return { expired, errors };
}

// ─── Fetch order for payment page ───────────────────────────

export async function getOrderForPayment(orderId: string) {
  // Fetch order first
  const { data, error } = await supabaseAdmin
    .from("order")
    .select("*")
    .eq("id", orderId)
    .single();

  if (error || !data) return null;

  // Always fetch items separately (embedded join unreliable)
  const { data: items, error: itemsError } = await supabaseAdmin
    .from("order_item")
    .select("*")
    .eq("order_id", orderId);

  if (!itemsError && items) {
    data.order_item = items;
  }

  return data;
}
