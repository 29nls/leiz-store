import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-helpers";
import { successResponse } from "@/lib/errors";
import { corsHeaders, handleCors } from "@/lib/middleware";
import { prisma } from "@/lib/db";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
  });

  // Get product counts manually
  const result = await Promise.all(
    categories.map(async (c) => {
      const productCount = await prisma.product.count({
        where: { categoryId: c.id },
      });

      return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        icon: c.icon,
        sortOrder: c.sortOrder,
        isActive: c.isActive,
        products: productCount,
      };
    })
  );

  return NextResponse.json(successResponse(result), { headers: corsHeaders() });
});
