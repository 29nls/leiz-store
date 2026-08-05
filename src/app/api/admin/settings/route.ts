/**
 * Admin Settings API
 * Direct Supabase connection for store settings management
 */

import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";
import {
  successResponse,
  errorResponse,
  AppError,
  UnauthorizedError,
  ValidationError,
} from "@/lib/errors";
import { upsertSettingSchema, zodErrorMessages } from "@/lib/validators/admin";
import { enforceAdminRateLimit } from "@/lib/rate-limit";

async function checkAuth() {
  return isAdminRequest();
}

function unauthorized() {
  return NextResponse.json(errorResponse(new UnauthorizedError()), { status: 401 });
}

function internalError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  return NextResponse.json(
    errorResponse(new AppError(500, "INTERNAL_ERROR", message)),
    { status: 500 }
  );
}

// GET /api/admin/settings
export async function GET(request: Request) {
  const limited = await enforceAdminRateLimit(request, "settings");
  if (limited) return limited;

  if (!(await checkAuth())) return unauthorized();

  try {
    const { data: settings, error } = await supabaseAdmin
      .from("setting")
      .select("*")
      .order("group_name", { ascending: true })
      .order("key", { ascending: true });

    if (error) throw error;

    return NextResponse.json(successResponse(settings || []));
  } catch (error: any) {
    return internalError(error);
  }
}

// PUT /api/admin/settings
export async function PUT(request: Request) {
  const limited = await enforceAdminRateLimit(request, "settings");
  if (limited) return limited;

  if (!(await checkAuth())) return unauthorized();

  try {
    const body = await request.json();
    const parsed = upsertSettingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        errorResponse(new ValidationError(zodErrorMessages(parsed.error))),
        { status: 400 }
      );
    }

    const { key, value, type, group } = parsed.data;

    // Upsert the setting
    const { data: existing } = await supabaseAdmin
      .from("setting")
      .select("id")
      .eq("key", key)
      .limit(1);

    let result;
    if (existing && existing.length > 0) {
      const { data, error } = await supabaseAdmin
        .from("setting")
        .update({ value, type: type || "text", group_name: group || "general" })
        .eq("key", key)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabaseAdmin
        .from("setting")
        .insert({
          key,
          value,
          type: type || "text",
          group_name: group || "general",
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    return NextResponse.json(
      successResponse({ setting: result, message: "Setting updated successfully" })
    );
  } catch (error: any) {
    return internalError(error);
  }
}
