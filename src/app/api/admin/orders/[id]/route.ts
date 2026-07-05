/**
 * Admin Single Order API
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { isValidTransition, STATUS_TRANSITIONS } from "@/lib/payment/constants";
import { logOrderStatusChange } from "@/lib/payment/order-logger";
import { sendBuyerNotification } from "@/lib/discord/bot";

async function checkAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return false;
  const payload = verifyJWT(token);
  return payload?.role === "ADMIN";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const { data: order, error } = await supabaseAdmin
      .from("order")
      .select("*, items:order_item(*), payment:payment(*)")
      .eq("id", id)
      .single();

    if (error) throw error;
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    return NextResponse.json({ order });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { status, customerName, notes } = body;

    // ── Fetch current order (for transition validation & notifications) ──────
    const { data: currentOrder, error: fetchError } = await supabaseAdmin
      .from("order")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !currentOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const updateData: any = { updated_at: new Date().toISOString() };

    if (status !== undefined) {
      const newStatus = status.toUpperCase();

      // ── Validate status transition ─────────────────────────────────────────
      if (!isValidTransition(currentOrder.status, newStatus)) {
        return NextResponse.json(
          {
            error: `Transisi status tidak valid: ${currentOrder.status} → ${newStatus}`,
            allowedTransitions: STATUS_TRANSITIONS[currentOrder.status] || [],
          },
          { status: 400 }
        );
      }

      updateData.status = newStatus;

      // Set timestamps based on new status
      if (newStatus === "PAID") {
        updateData.paid_at = new Date().toISOString();
      }
      if (newStatus === "COMPLETED") {
        updateData.completed_at = new Date().toISOString();
      }
      if (newStatus === "CANCELLED" || newStatus === "FORCE_CANCELLED") {
        updateData.cancelled_at = new Date().toISOString();
      }
    }

    if (customerName !== undefined) updateData.customer_name = customerName;
    if (notes !== undefined) updateData.notes = notes;

    const { data: order, error: updateError } = await supabaseAdmin
      .from("order")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError) throw updateError;

    // ── Log the status change ────────────────────────────────────────────────
    if (status !== undefined) {
      const cookieStore = await cookies();
      const token = cookieStore.get("admin_token")?.value;
      const adminPayload = token ? verifyJWT(token) : null;

      await logOrderStatusChange({
        orderId: id,
        actorType: "ADMIN",
        actorId: adminPayload?.sub || adminPayload?.email || "admin",
        action: `STATUS_UPDATE_${status.toUpperCase()}`,
        previousStatus: currentOrder.status,
        newStatus: status.toUpperCase(),
      });

      // ── Send buyer Discord notification for relevant status changes ────────
      const buyerStatusMessages: Record<string, string> = {
        PAID: "✅ Pembayaran Anda telah diverifikasi! Pesanan sedang diproses.",
        REJECTED:
          "⚠️ Pembayaran Anda belum terdeteksi. Silakan periksa kembali dan hubungi admin.",
        CANCELLED: "❌ Pesanan Anda telah dibatalkan oleh admin.",
        FORCE_CANCELLED: "❌ Pesanan Anda telah dibatalkan oleh admin.",
        PROCESSING: "⚙️ Pesanan Anda sedang diproses oleh admin.",
        COMPLETED:
          "✅ Pesanan Anda telah selesai! Silakan hubungi admin untuk detail lebih lanjut.",
      };

      const buyerDiscordId =
        currentOrder.buyer_discord_id || currentOrder.customer_discord;
      const buyerMessage = buyerStatusMessages[status.toUpperCase()];

      if (buyerDiscordId && buyerMessage) {
        const orderNumber = currentOrder.order_number || order.order_number || "—";
        sendBuyerNotification(
          buyerDiscordId,
          orderNumber,
          buyerMessage
        ).catch((err) =>
          console.error("[Admin Orders] Buyer notification failed:", err)
        );
      }
    }

    return NextResponse.json({
      success: true,
      order,
      message: "Order updated successfully",
    });
  } catch (error: any) {
    console.error("[Admin Orders] PUT error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Delete order items and payment first
    await supabaseAdmin.from("order_item").delete().eq("order_id", id);
    await supabaseAdmin.from("payment").delete().eq("order_id", id);

    const { error } = await supabaseAdmin.from("order").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true, message: "Order deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
