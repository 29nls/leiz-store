/**
 * Admin Token Verification API
 */

import { NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/admin-auth";

export async function GET(request: Request) {
  const admin = await authenticateAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({
    valid: true,
    user: { id: admin.id, email: admin.email, name: admin.name, role: "ADMIN" },
  });
}