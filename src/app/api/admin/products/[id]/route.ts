import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api-helpers";
import { successResponse } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/utils";

// PUT /api/admin/products/:id - Update product
export const PUT = withErrorHandling(
  async (
    req: NextRequest,
    context?: { params: Promise<Record<string, string>> }
  ) => {
    const { id } = await context!.params;
    const body = await req.json();

    // Check if product exists
    const existingProduct = await prisma.product.findUnique({
      where: { id },
      include: { images: true },
    });

    if (!existingProduct) {
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      );
    }

    const {
      name,
      description,
      price,
      priceUSD,
      comparePrice,
      comparePriceUSD,
      unit,
      stock,
      minStock,
      badge,
      isActive,
      isFeatured,
      categoryId,
      imageUrl,
    } = body;

    // Generate new slug if name changed
    let slug = existingProduct.slug;
    if (name && name !== existingProduct.name) {
      slug = slugify(name);

      // Check if new slug conflicts with another product
      const conflict = await prisma.product.findUnique({ where: { slug } });
      if (conflict && conflict.id !== id) {
        return NextResponse.json(
          { success: false, error: "Product with this name already exists" },
          { status: 400 }
        );
      }
    }

    // Update product
    const product = await prisma.product.update({
      where: { id },
      data: {
        ...(name && { name, slug }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price: Number(price) }),
        ...(priceUSD !== undefined && { priceUSD: Number(priceUSD) }),
        ...(comparePrice !== undefined && {
          comparePrice: comparePrice ? Number(comparePrice) : undefined,
        }),
        ...(comparePriceUSD !== undefined && {
          comparePriceUSD: comparePriceUSD ? Number(comparePriceUSD) : undefined,
        }),
        ...(unit !== undefined && { unit }),
        ...(stock !== undefined && { stock: Number(stock) }),
        ...(minStock !== undefined && { minStock: Number(minStock) }),
        ...(badge !== undefined && { badge: badge || undefined }),
        ...(isActive !== undefined && { isActive }),
        ...(isFeatured !== undefined && { isFeatured }),
        ...(categoryId !== undefined && { categoryId }),
      },
      include: {
        category: true,
      },
    });
    if (imageUrl !== undefined) {
      // Delete old images
      await prisma.productImage.deleteMany({
        where: { productId: id },
      });

      // Create new image if URL provided
      if (imageUrl) {
        await prisma.productImage.create({
          data: {
            productId: id,
            url: imageUrl,
            sortOrder: 0,
          },
        });
      }
    }

    // Reload product with images
    const productWithImages = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        images: { orderBy: { sortOrder: "asc" } },
      },
    });

    return NextResponse.json(successResponse(productWithImages));
  }
);

// DELETE /api/admin/products/:id - Delete product
export const DELETE = withErrorHandling(
  async (
    req: NextRequest,
    context?: { params: Promise<Record<string, string>> }
  ) => {
    const { id } = await context!.params;

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      );
    }

    // Delete product images first
    await prisma.productImage.deleteMany({
      where: { productId: id },
    });

    // Delete product
    await prisma.product.delete({
      where: { id },
    });

    return NextResponse.json(
      successResponse({ id, deleted: true }),
      { status: 200 }
    );
  }
);
