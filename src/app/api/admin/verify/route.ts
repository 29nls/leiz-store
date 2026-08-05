/**
 * Admin Token Verification API
 */

import { NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/admin-auth";
import {
  successResponse,
  errorResponse,
  UnauthorizedError,
} from "@/lib/errors";
import { enforceAdminRateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const limited = await enforceAdminRateLimit(request, "verify");
  if (limited) return limited;

  const admin = await authenticateAdmin(request);
  if (!admin) {
    return NextResponse.json(errorResponse(new UnauthorizedError()), { status: 401 });
  }

  return NextResponse.json(
    successResponse({
      valid: true,
      user: { id: admin.id, email: admin.email, name: admin.name, role: "ADMIN" },
    })
  );
}