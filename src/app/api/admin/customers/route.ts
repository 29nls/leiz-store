import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-helpers";
import { successResponse } from "@/lib/errors";
import { corsHeaders, handleCors, parsePagination } from "@/lib/middleware";
import { prisma } from "@/lib/db";
import { Role, OrderStatus } from "@generated/prisma/client";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const { searchParams } = new URL(req.url);
  const { page, limit } = parsePagination(searchParams);
  const search = searchParams.get("q") || undefined;

  const where: Record<string, unknown> = { role: Role.CUSTOMER };
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { email: { contains: search } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: {
        orders: {
          where: { status: { in: [OrderStatus.PAID, OrderStatus.COMPLETED] } },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  const customers = users.map((u: any) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    orders: u.orders?.length || 0,
    spent: (u.orders || []).reduce((sum: number, o: any) => sum + Number(o.total), 0),
    lastOrder: u.orders && u.orders.length > 0
      ? u.orders.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0].createdAt
      : null,
    createdAt: u.createdAt,
  }));

  return NextResponse.json(
    successResponse(customers, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    }),
    { headers: corsHeaders() }
  );
});
