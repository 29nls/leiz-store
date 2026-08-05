/**
 * Admin Products API
 * Direct Supabase connection for full CRUD
 */

import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { createProductSchema, zodErrorMessages } from "@/lib/validators/admin";
import { successResponse, errorResponse, AppError, UnauthorizedError, ValidationError } from "@/lib/errors";

// Auth helper
async function checkAuth() {
  return isAdminRequest();
}

// GET /api/admin/products
export async function GET(request: Request) {
  if (!(await checkAuth())) {
    return NextResponse.json(errorResponse(new UnauthorizedError()), { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const category = searchParams.get("category") || "";
  const sort = searchParams.get("sort") || "created_at";
  const order = searchParams.get("order") || "desc";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const offset = (page - 1) * limit;

  try {
    let query = supabaseAdmin
      .from("product")
      .select("*, category:category(id,name,slug), images:product_image(*)", { count: "exact" });

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,slug.ilike.%${search}%`);
    }

    if (category) {
      query = query.eq("category_id", category);
    }

    const { data, error, count } = await query
      .order(sort, { ascending: order === "asc" })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const total = count || 0;
    return NextResponse.json(successResponse(data || [], {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    }));
  } catch (error: any) {
    return NextResponse.json(
      errorResponse(new AppError(500, "INTERNAL_ERROR", error.message)),
      { status: 500 }
    );
  }
}

// POST /api/admin/products
export async function POST(request: Request) {
  if (!(await checkAuth())) {
    return NextResponse.json(errorResponse(new UnauthorizedError()), { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createProductSchema.safeParse(body);
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

    // Check if slug already exists
    const { data: existing } = await supabaseAdmin
      .from("product")
      .select("id")
      .eq("slug", slug)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        errorResponse(new AppError(409, "CONFLICT", "Slug already exists")),
        { status: 409 }
      );
    }

    // Create product
    const productData: any = {
      id: crypto.randomUUID(),
      name,
      slug,
      description: description || "",
      price,
      unit: unit || "pc",
      stock: stock || 0,
      min_stock: minStock || 5,
      is_active: isActive !== undefined ? isActive : true,
      is_featured: isFeatured || false,
      category_id: categoryId,
    };

    if (comparePrice) productData.compare_price = comparePrice;
    if (badge) productData.badge = badge;

    const { data: product, error } = await supabaseAdmin
      .from("product")
      .insert(productData)
      .select()
      .single();

    if (error) throw error;

    // Create product images if provided
    if (images && images.length > 0) {
      const imageRecords = images.map((img: any, index: number) => ({
        id: crypto.randomUUID(),
        product_id: product.id,
        url: img.url,
        alt: img.alt || name,
        sort_order: img.sortOrder || index,
      }));

      const { error: imgError } = await supabaseAdmin
        .from("product_image")
        .insert(imageRecords);

      if (imgError) throw imgError;
    }

    return NextResponse.json(
      successResponse({ product, message: "Product created successfully" }),
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      errorResponse(new AppError(500, "INTERNAL_ERROR", error.message)),
      { status: 500 }
    );
  }
}