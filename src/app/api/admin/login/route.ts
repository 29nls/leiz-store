/**
 * Admin Login API
 * Supabase Auth login with a temporary legacy-cookie fallback.
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { signJWT } from "@/lib/auth";

// Supabase Auth is the canonical admin credential store. The legacy env-based
// login is retained only as a controlled migration fallback.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

function credentialsConfigured(): boolean {
  return Boolean(ADMIN_EMAIL && ADMIN_PASSWORD);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email: String(email).trim().toLowerCase(),
      password: String(password),
    });

    if (!authError && authData.user?.email) {
      const { data: profile } = await supabaseAdmin
        .from("user")
        .select("id, email, name, role, is_active")
        .eq("email", authData.user.email)
        .maybeSingle();

      if (profile?.role === "ADMIN" && profile.is_active !== false) {
        return NextResponse.json({
          success: true,
          user: { id: profile.id, email: profile.email, name: profile.name, role: profile.role },
        });
      }
      await supabaseAdmin.auth.signOut();
      return NextResponse.json({ error: "Akses ditolak. Hanya admin yang dapat masuk." }, { status: 403 });
    }

    // Compatibility fallback for deployments that have not migrated credentials.
    if (!credentialsConfigured()) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Legacy fallback is deliberately exact-match and only sets the compatibility
    // cookie; new sessions use Supabase Auth.
    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const token = signJWT({
      sub: "admin",
      email: ADMIN_EMAIL!,
      role: "ADMIN",
    });

    const response = NextResponse.json({
      success: true,
      user: { email: ADMIN_EMAIL, role: "ADMIN" },
    });

    response.cookies.set("admin_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60, // 24 hours
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("[admin/login] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}