import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-helpers";
import { errorResponse, RateLimitError, successResponse } from "@/lib/errors";
import { productService } from "@/lib/services";
import {
  addRateLimitHeaders,
  corsHeaders,
  getClientIp,
  handleCors,
  PUBLIC_READ_RATE_LIMIT,
  safeCheckRateLimit,
} from "@/lib/middleware";
import type { Currency } from "@/lib/currency";

export const GET = withErrorHandling(
  async (
    req: NextRequest,
    context?: { params: Promise<Record<string, string>> }
  ) => {
    const corsResponse = handleCors(req);
    if (corsResponse) return corsResponse;

    const rateLimit = await safeCheckRateLimit(
      `products:detail:${getClientIp(req)}`,
      PUBLIC_READ_RATE_LIMIT.max,
      PUBLIC_READ_RATE_LIMIT.windowMs
    );
    if (!rateLimit.allowed) {
    const response = NextResponse.json(
      errorResponse(new RateLimitError("Too many requests. Please try again later.")),
      { status: 429, headers: corsHeaders(req.headers.get("origin") || undefined) }
    );
    return addRateLimitHeaders(response, rateLimit, PUBLIC_READ_RATE_LIMIT.max);
    }

    const { slug } = await context!.params;
    const { searchParams } = new URL(req.url);
    const currency = (searchParams.get("currency") || "IDR") as Currency;

    const product = await productService.getBySlug(slug, currency);

    return NextResponse.json(successResponse(product), { headers: corsHeaders() });
  }
);
