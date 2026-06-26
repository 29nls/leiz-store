/**
 * Admin Login API
 * Simple credential-based auth for admin panel access
 */

import { NextResponse } from "next/server";
import { signJWT } from "@/lib/auth";

// Admin credentials - in production, store these securely
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@leizstore.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const token = signJWT({
      sub: "admin",
      email: ADMIN_EMAIL,
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
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}