/**
 * Admin Users API — List & Create
 *
 * Uses Supabase Auth admin API (service role) to manage users.
 * Cannot be done client-side because admin operations require
 * the service_role key.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";
import crypto from "crypto";

function generateId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 25);
}

// ─── GET: List all users ──────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page") || "1"));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || "20")));
    const search = searchParams.get("search") || "";
    const role = searchParams.get("role") || "";

    // Query the public.user table (has role info)
    let query = supabaseAdmin
      .from("user")
      .select("id, email, name, role, avatar, discord, phone, is_active, last_login_at, created_at, updated_at", { count: "exact" });

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }
    if (role) {
      query = query.eq("role", role);
    }

    const from = (page - 1) * limit;
    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(from, from + limit - 1);

    if (error) throw error;

    // Also fetch auth-level last_sign_in_at from Supabase Auth for each user
    // This requires listing auth users, which is expensive — skip if > 50 users
    let authUsers: Record<string, { last_sign_in_at: string | null; banned_until: string | null }> = {};
    if ((count || 0) <= 50) {
      const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 100 });
      if (authData?.users) {
        for (const u of authData.users) {
          authUsers[u.email || ""] = {
            last_sign_in_at: u.last_sign_in_at || null,
            banned_until: u.banned_until || null,
          };
        }
      }
    }

    // Merge auth info into user records
    const users = (data || []).map((u) => ({
      ...u,
      last_sign_in_at: authUsers[u.email]?.last_sign_in_at || u.last_login_at,
      banned_until: authUsers[u.email]?.banned_until || null,
    }));

    return NextResponse.json({
      users,
      total: count || 0,
      page,
      totalPages: Math.ceil((count || 0) / limit) || 1,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to list users" }, { status: 500 });
  }
}

// ─── POST: Create a new admin user ────────────────────────────
export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = await req.json();
    const { email, password, name, role = "ADMIN", discord, phone } = body;

    // Validate
    if (!email || !password || !name) {
      return NextResponse.json({ error: "Email, password, dan nama wajib diisi" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Format email tidak valid" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Password minimal 6 karakter" }, { status: 400 });
    }
    if (!["ADMIN", "CUSTOMER"].includes(role)) {
      return NextResponse.json({ error: "Role tidak valid" }, { status: 400 });
    }

    // Check if email already exists in public.user
    const { data: existing } = await supabaseAdmin
      .from("user")
      .select("id")
      .eq("email", email)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: "Email sudah terdaftar" }, { status: 409 });
    }

    // Step 1: Create in Supabase Auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role },
    });

    if (authError) {
      if (authError.message.includes("already exists")) {
        return NextResponse.json({ error: "Email sudah terdaftar di sistem autentikasi" }, { status: 409 });
      }
      throw authError;
    }

    // Step 2: Create in public.user table
    const hashedPassword = crypto.createHash("sha256").update(password).digest("hex");
    const userId = generateId();

    const { error: insError } = await supabaseAdmin.from("user").insert({
      id: userId,
      email,
      password: hashedPassword,
      name,
      role,
      discord: discord || null,
      phone: phone || null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (insError) {
      // Rollback: delete from Auth if public.user insert fails
      await supabaseAdmin.auth.admin.deleteUser(authUser!.user.id);
      throw insError;
    }

    return NextResponse.json({
      user: { id: userId, email, name, role, is_active: true },
      message: "Admin berhasil dibuat",
    }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create user" }, { status: 500 });
  }
}
