/**
 * Admin Login API
 * Supabase Auth login with a temporary legacy-cookie fallback.
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { signJWT } from "@/lib/auth";
import {
  getClientIp,
  LOGIN_RATE_LIMIT,
  resetRateLimit,
  safeCheckRateLimit,
  safePeekRateLimit,
} from "@/lib/middleware";

// Supabase Auth is the canonical admin credential store. The legacy env-based
// login is retained only as a controlled migration fallback.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

function credentialsConfigured(): boolean {
  return Boolean(ADMIN_EMAIL && ADMIN_PASSWORD);
}

/** Run the actual credential check; returns the response to send back. */
async function attemptLogin(rawEmail: string, password: string): Promise<NextResponse> {
  // Supabase Auth matches case-insensitively; the legacy fallback below is
  // deliberately an exact match against the raw input (unchanged behavior).
  const email = String(rawEmail).trim().toLowerCase();
  const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
    email,
    password,
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
  if (rawEmail !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
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
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    // Brute-force protection with dual buckets: per-IP and per-account. The
    // per-account bucket is the backstop against IP rotation — an attacker who
    // spoofs or rotates X-Forwarded-For still hits the account cap. Windows
    // auto-expire (no permanent lockout), and the safe* wrappers fail open so
    // a limiter bug can never lock the admin out. Thresholds are generous:
    // 20 attempts/IP and 10 attempts/account per 15 min (see LOGIN_RATE_LIMIT
    // in src/lib/middleware.ts). Only FAILED attempts count; a successful
    // login clears the counters.
    const normalizedEmail = String(email).trim().toLowerCase();
    const ipKey = `admin-login-ip:${getClientIp(request)}`;
    const acctKey = `admin-login-account:${normalizedEmail}`;
    const ipLimit = safePeekRateLimit(ipKey, LOGIN_RATE_LIMIT.ipMax, LOGIN_RATE_LIMIT.windowMs);
    const acctLimit = safePeekRateLimit(acctKey, LOGIN_RATE_LIMIT.accountMax, LOGIN_RATE_LIMIT.windowMs);

    if (!ipLimit.allowed || !acctLimit.allowed) {
      const retryAfter = Math.ceil(
        Math.min(ipLimit.resetAt, acctLimit.resetAt) / 1000 - Date.now() / 1000
      );
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.max(1, retryAfter)) } }
      );
    }

    const response = await attemptLogin(email, String(password));

    if (response.status >= 400) {
      // Record the failed attempt in both buckets (fail-open on limiter errors).
      safeCheckRateLimit(ipKey, LOGIN_RATE_LIMIT.ipMax, LOGIN_RATE_LIMIT.windowMs);
      safeCheckRateLimit(acctKey, LOGIN_RATE_LIMIT.accountMax, LOGIN_RATE_LIMIT.windowMs);
    } else {
      // Successful login clears the failure counters for this account/IP.
      resetRateLimit(ipKey);
      resetRateLimit(acctKey);
    }

    return response;
  } catch (err) {
    console.error("[admin/login] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
