/**
 * Admin Logout API
 */

import { NextResponse } from "next/server";
import { enforceAdminRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const limited = await enforceAdminRateLimit(request, "logout");
  if (limited) return limited;

  const response = NextResponse.json({ success: true });
  response.cookies.set("admin_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}