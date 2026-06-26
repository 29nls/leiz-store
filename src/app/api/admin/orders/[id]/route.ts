/**
 * Admin Single Order API
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

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
    const { status, customerName, customerEmail, notes } = body;

    const updateData: any = { updated_at: new Date().toISOString() };
    if (status !== undefined) {
      updateData.status = status.toUpperCase();
      if (status === "paid") updateData.paid_at = new Date().toISOString();
      if (status === "completed") updateData.completed_at = new Date().toISOString();
    }
    if (customerName !== undefined) updateData.customer_name = customerName;
    if (customerEmail !== undefined) updateData.customer_email = customerEmail;
    if (notes !== undefined) updateData.notes = notes;

    const { data: order, error } = await supabaseAdmin
      .from("order")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, order, message: "Order updated successfully" });
  } catch (error: any) {
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