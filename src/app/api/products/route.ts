import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-helpers";
import { successResponse } from "@/lib/errors";
import { productService } from "@/lib/services";
import { parsePagination, corsHeaders, handleCors } from "@/lib/middleware";
import type { Currency } from "@/lib/currency";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const { searchParams } = new URL(req.url);
  const { page, limit } = parsePagination(searchParams);
  const category = searchParams.get("category") || undefined;
  const search = searchParams.get("q") || undefined;
  const sort = searchParams.get("sort") || undefined;
  const badge = searchParams.get("badge") || undefined;
  const featured = searchParams.get("featured") === "true" ? true : undefined;
  const minPrice = searchParams.get("minPrice") ? Number(searchParams.get("minPrice")) : undefined;
  const maxPrice = searchParams.get("maxPrice") ? Number(searchParams.get("maxPrice")) : undefined;
  const currency = (searchParams.get("currency") || "IDR") as Currency;

  const result = await productService.list({
    page, limit, category, search, sort, badge, featured, minPrice, maxPrice, currency,
  });

  return NextResponse.json(successResponse(result.items, {
    page: result.page,
    limit: result.limit,
    total: result.total,
    totalPages: result.totalPages,
  }), { headers: corsHeaders() });
});
