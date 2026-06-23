import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-helpers";
import { successResponse } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";

// POST /api/admin/products - Create new product
export const POST = withErrorHandling(async (req: NextRequest) => {
  const body = await req.json();

  const {
    name,
    description,
    price,
    priceUSD,
    comparePrice,
    comparePriceUSD,
    unit = "pc",
    stock = 0,
    minStock = 10,
    badge,
    isActive = true,
    isFeatured = false,
    categoryId,
    imageUrl,
  } = body;

  // Validate required fields
  if (!name || !description || !price || !categoryId) {
    return NextResponse.json(
      { success: false, error: "Missing required fields" },
      { status: 400 }
    );
  }

  // Generate slug
  const slug = slugify(name);

  // Check if slug already exists
  const existing = await prisma.product.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json(
      { success: false, error: "Product with this name already exists" },
      { status: 400 }
    );
  }

  // Create product
  const product = await prisma.product.create({
    data: {
      name,
      slug,
      description,
      price: Number(price),
      priceUSD: priceUSD ? Number(priceUSD) : undefined,
      comparePrice: comparePrice ? Number(comparePrice) : undefined,
      comparePriceUSD: comparePriceUSD ? Number(comparePriceUSD) : undefined,
      unit,
      stock: Number(stock),
      minStock: Number(minStock),
      badge: badge || undefined,
      isActive,
      isFeatured,
      categoryId,
      tags: "",
      storeId: null,
    },
    include: {
      category: true,
    },
  });

  // Create product image if provided
  if (imageUrl) {
    await prisma.productImage.create({
      data: {
        productId: product.id,
        url: imageUrl,
        sortOrder: 0,
      },
    });
  }

  // Reload product with images
  const productWithImages = await prisma.product.findUnique({
    where: { id: product.id },
    include: {
      category: true,
      images: { orderBy: { sortOrder: "asc" } },
    },
  });

  return NextResponse.json(successResponse(productWithImages), { status: 201 });
});
