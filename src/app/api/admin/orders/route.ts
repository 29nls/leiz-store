import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-helpers";
import { successResponse } from "@/lib/errors";
import { corsHeaders, handleCors, parsePagination } from "@/lib/middleware";
import { prisma } from "@/lib/db";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const { searchParams } = new URL(req.url);
  const { page, limit } = parsePagination(searchParams);
  const status = searchParams.get("status") || undefined;
  const search = searchParams.get("q") || undefined;

  const where: Record<string, unknown> = {};
  if (status && status !== "all") {
    where.status = status.toUpperCase();
  }
  if (search) {
    where.OR = [
      { orderNumber: { contains: search } },
      { customerName: { contains: search } },
      { customerEmail: { contains: search } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { items: { select: { id: true, name: true, quantity: true, price: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.order.count({ where }),
  ]);

  return NextResponse.json(
    successResponse(items, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    }),
    { headers: corsHeaders() }
  );
});
