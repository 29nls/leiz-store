/**
 * Admin Authentication Helper
 *
 * Verifies the caller is an authenticated admin via their Supabase session.
 * Used by API routes that require admin-only access.
 */

import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function requireAdmin(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cookieHeader = req.headers.get("cookie") || "";
  let token = authHeader?.replace("Bearer ", "") || null;

  if (!token) {
    const sessionMatch = cookieHeader.match(/sb-[^-]+-auth-token=([^;]+)/);
    if (sessionMatch) {
      try {
        const sessionData = JSON.parse(decodeURIComponent(sessionMatch[1]));
        if (sessionData?.access_token) token = sessionData.access_token;
      } catch { /* ignore */ }
    }
  }

  if (!token) throw new Error("Unauthorized");

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) throw new Error("Unauthorized");

  const { data: userData } = await supabaseAdmin
    .from("user")
    .select("role")
    .eq("email", user.email)
    .single();

  if (!userData || userData.role !== "ADMIN") {
    throw new Error("Forbidden: Admin access required");
  }

  return user;
}
