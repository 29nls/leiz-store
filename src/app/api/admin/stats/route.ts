/**
 * Admin Dashboard Stats API
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

export async function GET() {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [
      { count: totalProducts },
      { count: totalCategories },
      { count: totalOrders },
      { count: pendingOrders },
      { data: recentOrders },
      { data: allLowProducts },
    ] = await Promise.all([
      supabaseAdmin.from("product").select("*", { count: "exact", head: true }).eq("is_active", true),
      supabaseAdmin.from("category").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("order").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("order").select("*", { count: "exact", head: true }).eq("status", "PENDING"),
      supabaseAdmin.from("order").select("id,order_number,customer_name,total,status,created_at")
        .order("created_at", { ascending: false }).limit(10),
      supabaseAdmin.from("product").select("id,name,slug,stock,min_stock")
        .eq("is_active", true)
        .order("stock", { ascending: true })
        .limit(20),
    ]);

    const lowStockProducts = (allLowProducts || [])
      .filter((p: any) => p.stock <= p.min_stock)
      .slice(0, 5);

    return NextResponse.json({
      stats: {
        totalProducts: totalProducts || 0,
        totalCategories: totalCategories || 0,
        totalOrders: totalOrders || 0,
        pendingOrders: pendingOrders || 0,
      },
      recentOrders: recentOrders || [],
      lowStockProducts,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}