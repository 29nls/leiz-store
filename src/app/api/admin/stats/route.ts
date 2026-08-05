/**
 * Admin Dashboard Stats API
 *
 * Returns all data needed by the admin dashboard in a single endpoint.
 * Each query is independently wrapped in try/catch so that a failure in one
 * table (e.g. a transient Supabase error on "order") does not crash the
 * entire dashboard — partial data is still returned with a warning array.
 */

import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";
import {
  successResponse,
  errorResponse,
  UnauthorizedError,
} from "@/lib/errors";
import { enforceAdminRateLimit } from "@/lib/rate-limit";

async function checkAuth() {
  return isAdminRequest();
}

/** Run a single Supabase query and return [data|count, null] or [null, errorMessage]. */
async function safeQuery(
  label: string,
  fn: () => any
): Promise<{ data: any; count: any; error: string | null }> {
  try {
    const result = await fn();
    if (result.error) {
      console.error(`[Stats] Query "${label}" failed:`, result.error.message);
      return { data: null, count: null, error: result.error.message };
    }
    return { data: result.data, count: result.count, error: null };
  } catch (err) {
    console.error(`[Stats] Query "${label}" threw:`, err);
    return {
      data: null,
      count: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function GET(request: Request) {
  const limited = await enforceAdminRateLimit(request, "stats");
  if (limited) return limited;

  if (!(await checkAuth())) {
    return NextResponse.json(errorResponse(new UnauthorizedError()), { status: 401 });
  }

  const warnings: string[] = [];

  // ── Run all queries independently ──────────────────────────────────────────
  const [
    productsRes,
    activeProductsRes,
    categoriesRes,
    ordersRes,
    pendingRes,
    completedRes,
    revenueRes,
    recentRes,
    lowStockRes,
  ] = await Promise.all([
    safeQuery("totalProducts", () =>
      supabaseAdmin.from("product").select("*", { count: "exact", head: true })
    ),
    safeQuery("activeProducts", () =>
      supabaseAdmin
        .from("product")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true)
    ),
    safeQuery("totalCategories", () =>
      supabaseAdmin.from("category").select("*", { count: "exact", head: true })
    ),
    safeQuery("totalOrders", () =>
      supabaseAdmin.from("order").select("*", { count: "exact", head: true })
    ),
    safeQuery("pendingOrders", () =>
      supabaseAdmin
        .from("order")
        .select("*", { count: "exact", head: true })
        .eq("status", "PENDING")
    ),
    safeQuery("completedOrders", () =>
      supabaseAdmin
        .from("order")
        .select("*", { count: "exact", head: true })
        .eq("status", "COMPLETED")
    ),
    safeQuery("totalRevenue", () =>
      supabaseAdmin
        .from("order")
        .select("total")
        .eq("status", "COMPLETED")
    ),
    safeQuery("recentOrders", () =>
      supabaseAdmin
        .from("order")
        .select("id,order_number,customer_name,total,status,created_at")
        .order("created_at", { ascending: false })
        .limit(10)
    ),
    safeQuery("lowStockProducts", () =>
      supabaseAdmin
        .from("product")
        .select("id,name,slug,stock,min_stock")
        .eq("is_active", true)
        .order("stock", { ascending: true })
        .limit(50)
    ),
  ]);

  // Collect warnings for any failed queries
  for (const res of [
    productsRes, activeProductsRes, categoriesRes, ordersRes,
    pendingRes, completedRes, revenueRes, recentRes, lowStockRes,
  ]) {
    if (res.error) warnings.push(res.error);
  }

  // ── Process results with safe defaults ──────────────────────────────────────
  const totalRevenue = (revenueRes.data ?? []).reduce(
    (sum: number, o: any) => sum + (o.total || 0),
    0
  );

  const allProducts: any[] = lowStockRes.data ?? [];
  const lowStock = allProducts
    .filter((p: any) => p.min_stock != null && p.stock <= p.min_stock)
    .slice(0, 5);

  return NextResponse.json(
    successResponse({
      stats: {
        totalProducts: productsRes.count ?? 0,
        activeProducts: activeProductsRes.count ?? 0,
        totalCategories: categoriesRes.count ?? 0,
        totalOrders: ordersRes.count ?? 0,
        pendingOrders: pendingRes.count ?? 0,
        completedOrders: completedRes.count ?? 0,
        totalRevenue,
      },
      recentOrders: recentRes.data ?? [],
      lowStock,
      ...(warnings.length > 0 && { warnings }),
    })
  );
}
