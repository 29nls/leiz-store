/**
 * Admin Single Product API
 * Direct Supabase connection for update/delete
 */

import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { updateProductSchema, zodErrorMessages } from "@/lib/validators/admin";
import { successResponse, errorResponse, AppError, NotFoundError, UnauthorizedError, ValidationError } from "@/lib/errors";

async function checkAuth() {
  return isAdminRequest();
}

// PUT /api/admin/products/[id]
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await checkAuth())) {
    return NextResponse.json(errorResponse(new UnauthorizedError()), { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = updateProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        errorResponse(new ValidationError(zodErrorMessages(parsed.error))),
        { status: 400 }
      );
    }

    const {
      name, slug, description, price, comparePrice, unit,
      stock, minStock, badge, isActive, isFeatured,
      categoryId, images,
    } = parsed.data;

    // Check if product exists
    const { data: existing } = await supabaseAdmin
      .from("product")
      .select("id")
      .eq("id", id)
      .limit(1);

    if (!existing || existing.length === 0) {
      return NextResponse.json(errorResponse(new NotFoundError("Product", id)), { status: 404 });
    }

    // If slug changed, check uniqueness
    if (slug) {
      const { data: slugCheck } = await supabaseAdmin
        .from("product")
        .select("id")
        .eq("slug", slug)
        .neq("id", id)
        .limit(1);

      if (slugCheck && slugCheck.length > 0) {
        return NextResponse.json(
          errorResponse(new AppError(409, "CONFLICT", "Slug already exists")),
          { status: 409 }
        );
      }
    }

    // Build update data
    const updateData: any = { updated_at: new Date().toISOString() };
    if (name !== undefined) updateData.name = name;
    if (slug !== undefined) updateData.slug = slug;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = price;
    if (comparePrice !== undefined) updateData.compare_price = comparePrice;
    if (unit !== undefined) updateData.unit = unit;
    if (stock !== undefined) updateData.stock = stock;
    if (minStock !== undefined) updateData.min_stock = minStock;
    if (badge !== undefined) updateData.badge = badge;
    if (isActive !== undefined) updateData.is_active = isActive;
    if (isFeatured !== undefined) updateData.is_featured = isFeatured;
    if (categoryId !== undefined) updateData.category_id = categoryId;

    const { data: product, error } = await supabaseAdmin
      .from("product")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    // Update images if provided (delete old + insert new)
    if (images !== undefined) {
      await supabaseAdmin.from("product_image").delete().eq("product_id", id);

      if (images.length > 0) {
        const imageRecords = images.map((img: any, index: number) => ({
          id: crypto.randomUUID(),
          product_id: id,
          url: img.url,
          alt: img.alt || name || "",
          sort_order: img.sortOrder || index,
        }));

        await supabaseAdmin.from("product_image").insert(imageRecords);
      }
    }

    return NextResponse.json(successResponse({ product, message: "Product updated successfully" }));
  } catch (error: any) {
    return NextResponse.json(
      errorResponse(new AppError(500, "INTERNAL_ERROR", error.message)),
      { status: 500 }
    );
  }
}

// DELETE /api/admin/products/[id]
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await checkAuth())) {
    return NextResponse.json(errorResponse(new UnauthorizedError()), { status: 401 });
  }

  const { id } = await params;

  try {
    // Soft delete: set is_active = false to preserve order history
    const { error } = await supabaseAdmin
      .from("product")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json(successResponse({ message: "Produk berhasil dinonaktifkan" }));
  } catch (error: any) {
    return NextResponse.json(
      errorResponse(new AppError(500, "INTERNAL_ERROR", error.message)),
      { status: 500 }
    );
  }
}