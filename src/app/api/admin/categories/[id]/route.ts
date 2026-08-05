/**
 * Admin Single Category API
 */

import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { updateCategorySchema, zodErrorMessages } from "@/lib/validators/admin";
import { successResponse, errorResponse, AppError, NotFoundError, UnauthorizedError, ValidationError } from "@/lib/errors";
import { enforceAdminRateLimit } from "@/lib/rate-limit";

async function checkAuth() {
  return isAdminRequest();
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = await enforceAdminRateLimit(request, "categories");
  if (limited) return limited;

  if (!(await checkAuth())) {
    return NextResponse.json(errorResponse(new UnauthorizedError()), { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = updateCategorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        errorResponse(new ValidationError(zodErrorMessages(parsed.error))),
        { status: 400 }
      );
    }
    const { name, slug, description, icon, image, sortOrder, isActive, parentId } = parsed.data;

    const { data: existing } = await supabaseAdmin
      .from("category")
      .select("id")
      .eq("id", id)
      .limit(1);

    if (!existing || existing.length === 0) {
      return NextResponse.json(errorResponse(new NotFoundError("Category", id)), { status: 404 });
    }

    if (slug) {
      const { data: slugCheck } = await supabaseAdmin
        .from("category")
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

    return NextResponse.json(successResponse({ category, message: "Category updated successfully" }));
  } catch (error: any) {
    return NextResponse.json(
      errorResponse(new AppError(500, "INTERNAL_ERROR", error.message)),
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = await enforceAdminRateLimit(request, "categories");
  if (limited) return limited;

  if (!(await checkAuth())) {
    return NextResponse.json(errorResponse(new UnauthorizedError()), { status: 401 });
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
        errorResponse(new ValidationError(
          `Cannot delete category with ${count} product(s). Reassign or delete products first.`
        )),
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin.from("category").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json(successResponse({ message: "Category deleted successfully" }));
  } catch (error: any) {
    return NextResponse.json(
      errorResponse(new AppError(500, "INTERNAL_ERROR", error.message)),
      { status: 500 }
    );
  }
}