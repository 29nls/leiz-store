import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-helpers";
import { successResponse } from "@/lib/errors";
import { productService } from "@/lib/services";
import { corsHeaders, handleCors } from "@/lib/middleware";
import type { Currency } from "@/lib/currency";

export const GET = withErrorHandling(
  async (
    req: NextRequest,
    context?: { params: Promise<Record<string, string>> }
  ) => {
    const corsResponse = handleCors(req);
    if (corsResponse) return corsResponse;

    const { slug } = await context!.params;
    const { searchParams } = new URL(req.url);
    const currency = (searchParams.get("currency") || "IDR") as Currency;

    const product = await productService.getBySlug(slug, currency);

    return NextResponse.json(successResponse(product), { headers: corsHeaders() });
  }
);
