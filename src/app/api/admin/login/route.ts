/**
 * Admin Login API
 * Simple credential-based auth for admin panel access
 */

import { NextResponse } from "next/server";
import { signJWT } from "@/lib/auth";

// Admin credentials — must be set via environment variables.
// No hardcoded fallbacks: if missing, reject logins with a clear server error
// so the misconfiguration is caught immediately instead of silently allowing
// anyone who guesses the default to log in.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

function credentialsConfigured(): boolean {
  return Boolean(ADMIN_EMAIL && ADMIN_PASSWORD);
}

export async function POST(request: Request) {
  try {
    if (!credentialsConfigured()) {
      console.error(
        "[admin/login] ADMIN_EMAIL and ADMIN_PASSWORD env vars are not set. " +
        "Login rejected — configure them before attempting to sign in."
      );
      return NextResponse.json(
        { error: "Server misconfiguration — contact administrator" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Timing-safe comparison would be ideal but bcrypt comparison (used here for
    // demo) is not applicable since we compare plain-text creds in this route.
    // For production auth, prefer Supabase Auth — this is a fallback for the
    // simple admin login flow.
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