/**
 * Admin Settings API
 * Direct Supabase connection for store settings management
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

// GET /api/admin/settings
export async function GET() {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: settings, error } = await supabaseAdmin
      .from("setting")
      .select("*")
      .order("group_name", { ascending: true })
      .order("key", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ settings: settings || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/admin/settings
export async function PUT(request: Request) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { key, value, type, group } = body;

    if (!key || value === undefined) {
      return NextResponse.json({ error: "Key and value are required" }, { status: 400 });
    }

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

    return NextResponse.json({
      success: true,
      setting: result,
      message: "Setting updated successfully",
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
