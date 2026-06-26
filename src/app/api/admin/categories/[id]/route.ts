/**
 * Admin Single Category API
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
    const { name, slug, description, icon, image, sortOrder, isActive, parentId } = body;

    const { data: existing } = await supabaseAdmin
      .from("category")
      .select("id")
      .eq("id", id)
      .limit(1);

    if (!existing || existing.length === 0) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    if (slug) {
      const { data: slugCheck } = await supabaseAdmin
        .from("category")
        .select("id")
        .eq("slug", slug)
        .neq("id", id)
        .limit(1);

      if (slugCheck && slugCheck.length > 0) {
        return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
      }
    }

    const updateData: any = { updated_at: new Date().toISOString() };
    if (name !== undefined) updateData.name = name;
    if (slug !== undefined) updateData.slug = slug;
    if (description !== undefined) updateData.description = description;
    if (icon !== undefined) updateData.icon = icon;
    if (image !== undefined) updateData.image = image;
    if (sortOrder !== undefined) updateData.sort_order = sortOrder;
    if (isActive !== undefined) updateData.is_active = isActive;
    if (parentId !== undefined) updateData.parent_id = parentId;

    const { data: category, error } = await supabaseAdmin
      .from("category")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, category, message: "Category updated successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Check if category has products
    const { count } = await supabaseAdmin
      .from("product")
      .select("*", { count: "exact", head: true })
      .eq("category_id", id);

    if (count && count > 0) {
      return NextResponse.json(
        { error: `Cannot delete category with ${count} product(s). Reassign or delete products first.` },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin.from("category").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true, message: "Category deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}