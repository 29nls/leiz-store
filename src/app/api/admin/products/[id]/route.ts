/**
 * Admin Single Product API
 * Direct Supabase connection for update/delete
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJWT } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

async function checkAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;
  if (!token) return false;
  const payload = verifyJWT(token);
  return payload?.role === "ADMIN";
}

// PUT /api/admin/products/[id]
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const {
      name, slug, description, price, comparePrice, unit,
      stock, minStock, badge, isActive, isFeatured,
      categoryId, images,
    } = body;

    // Check if product exists
    const { data: existing } = await supabaseAdmin
      .from("product")
      .select("id")
      .eq("id", id)
      .limit(1);

    if (!existing || existing.length === 0) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
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
        return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
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
          product_id: id,
          url: img.url,
          alt: img.alt || name || "",
          sort_order: img.sortOrder || index,
        }));

        await supabaseAdmin.from("product_image").insert(imageRecords);
      }
    }

    return NextResponse.json({
      success: true,
      product,
      message: "Product updated successfully",
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/admin/products/[id]
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Delete product images first (cascade should handle this, but being explicit)
    await supabaseAdmin.from("product_image").delete().eq("product_id", id);

    const { error } = await supabaseAdmin
      .from("product")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}