/**
 * Admin Categories API
 * Direct Supabase connection for full CRUD
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

// GET /api/admin/categories
export async function GET() {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: categories, error } = await supabaseAdmin
      .from("category")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) throw error;

    // Get product count for each category
    const categoriesWithCount = await Promise.all(
      (categories || []).map(async (cat) => {
        const { count } = await supabaseAdmin
          .from("product")
          .select("*", { count: "exact", head: true })
          .eq("category_id", cat.id);
        return { ...cat, product_count: count || 0 };
      })
    );

    return NextResponse.json({ categories: categoriesWithCount });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/admin/categories
export async function POST(request: Request) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, slug, description, icon, image, sortOrder, isActive, parentId } = body;

    if (!name) {
      return NextResponse.json({ error: "Category name is required" }, { status: 400 });
    }

    // Auto-generate slug if not provided
    const generatedSlug = slug || name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    // Check if slug exists
    const { data: existing } = await supabaseAdmin
      .from("category")
      .select("id")
      .eq("slug", generatedSlug)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
    }

    const { data: category, error } = await supabaseAdmin
      .from("category")
      .insert({
        name,
        slug: generatedSlug,
        description: description || null,
        icon: icon || null,
        image: image || null,
        sort_order: sortOrder || 0,
        is_active: isActive !== undefined ? isActive : true,
        parent_id: parentId || null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      category,
      message: "Category created successfully",
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}