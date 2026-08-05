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
import { hashPassword } from "@/lib/auth";
import crypto from "crypto";
import { createUserSchema, zodErrorMessages } from "@/lib/validators/admin";
import { successResponse, errorResponse, AppError, ValidationError } from "@/lib/errors";
import { buildIlikeOrFilter } from "@/lib/supabase-search";

function generateId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 25);
}

function toEnvelopeError(e: unknown, fallback: string) {
  const err = e instanceof AppError
    ? e
    : new AppError(500, "INTERNAL_ERROR", e instanceof Error ? e.message : fallback);
  return NextResponse.json(errorResponse(err), { status: err.statusCode });
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
      query = query.or(buildIlikeOrFilter(["name", "email"], search));
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
    const authUsers: Record<string, { last_sign_in_at: string | null; banned_until: string | null }> = {};
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

    return NextResponse.json(successResponse(users, {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit) || 1,
    }));
  } catch (e: any) {
    return toEnvelopeError(e, "Failed to list users");
  }
}

// ─── POST: Create a new admin user ────────────────────────────
export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = await req.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        errorResponse(new ValidationError(zodErrorMessages(parsed.error))),
        { status: 400 }
      );
    }
    const { email, password, name, role, discord, phone } = parsed.data;

    // Check if email already exists in public.user
    const { data: existing } = await supabaseAdmin
      .from("user")
      .select("id")
      .eq("email", email)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        errorResponse(new AppError(409, "CONFLICT", "Email sudah terdaftar")),
        { status: 409 }
      );
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
        return NextResponse.json(
          errorResponse(new AppError(409, "CONFLICT", "Email sudah terdaftar di sistem autentikasi")),
          { status: 409 }
        );
      }
      throw authError;
    }

    // Step 2: Create in public.user table
    // hashPassword uses PBKDF2 with 100k iterations + SHA-512 + random 16-byte salt —
    // a NIST-recommended key-derivation function recognized as secure by CodeQL (CWE-916).
    const hashedPassword = await hashPassword(password);
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

    return NextResponse.json(
      successResponse({
        user: { id: userId, email, name, role, is_active: true },
        message: "Admin berhasil dibuat",
      }),
      { status: 201 }
    );
  } catch (e: any) {
    return toEnvelopeError(e, "Failed to create user");
  }
}
