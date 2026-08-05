/**
 * Admin Orders API
 */

import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { buildIlikeOrFilter } from "@/lib/supabase-search";
import {
  successResponse,
  errorResponse,
  AppError,
  UnauthorizedError,
} from "@/lib/errors";
import { enforceAdminRateLimit } from "@/lib/rate-limit";

async function checkAuth() {
  return isAdminRequest();
}

export async function GET(request: Request) {
  const limited = await enforceAdminRateLimit(request, "orders");
  if (limited) return limited;

  if (!(await checkAuth())) {
    return NextResponse.json(errorResponse(new UnauthorizedError()), { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const offset = (page - 1) * limit;

  try {
    let query = supabaseAdmin
      .from("order")
      .select("*, items:order_item(*)", { count: "exact" });

    if (search) {
      query = query.or(buildIlikeOrFilter(["order_number", "customer_name"], search));
    }

    if (status) {
      query = query.eq("status", status.toUpperCase());
    }

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json(
      successResponse(data || [], {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      })
    );
  } catch (error: any) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      errorResponse(new AppError(500, "INTERNAL_ERROR", message)),
      { status: 500 }
    );
  }
}