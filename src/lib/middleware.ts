/**
 * API Middleware
 * CORS, rate limiting, pagination, and request utilities
 */

import { NextRequest, NextResponse } from "next/server";

/**
 * Store context extracted from request headers/query
 */
export interface StoreContext {
  storeId?: string;
  storeSlug?: string;
}

/**
 * Extract store context from the request.
 * Supports X-Store-Id / X-Store-Slug headers and ?store_slug= query param.
 */
export function extractStoreContext(request: NextRequest): StoreContext {
  const headerStoreId = request.headers.get("x-store-id") || undefined;
  const headerStoreSlug = request.headers.get("x-store-slug") || undefined;
  const queryStoreSlug = request.nextUrl.searchParams.get("store_slug") || undefined;

  return {
    storeId: headerStoreId,
    storeSlug: headerStoreSlug || queryStoreSlug,
  };
}

/**
 * Apply store-scoped where clause to any Prisma query.
 */
export function storeScope(storeId?: string): Record<string, string> {
  return storeId ? { storeId } : {};
}

/**
 * CORS headers
 */
export function corsHeaders(origin?: string): HeadersInit {
  const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:3000").split(",");
  const isAllowed = !origin || allowedOrigins.includes(origin);

  return {
    "Access-Control-Allow-Origin": isAllowed ? (origin || "*") : "",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Idempotency-Key",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
  };
}

/**
 * Handle CORS preflight
 */
export function handleCors(request: NextRequest): NextResponse | null {
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders(request.headers.get("origin") || undefined),
    });
  }
  return null;
}

/**
 * Extract client IP from request.
 *
 * Trust model: in the Docker deployment only the Caddy reverse proxy
 * (Caddyfile) publishes ports, and Caddy replaces any client-supplied
 * X-Forwarded-For with the real peer IP — so the first value is trustworthy.
 * On Vercel the edge likewise sets X-Forwarded-For to the real client IP.
 * Only when the app is exposed directly (no trusted proxy in front) can a
 * client spoof this header; the account-keyed login throttle is the backstop
 * in that case (see LOGIN_RATE_LIMIT below).
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim() || "";
  const candidate = first || request.headers.get("x-real-ip")?.trim() || "";
  return candidate.length > 0 && candidate.length <= 64 ? candidate : "unknown";
}

/**
 * Extract user agent
 */
export function getUserAgent(request: NextRequest): string {
  return request.headers.get("user-agent") || "unknown";
}

// Rate limiting lives in ./rate-limit (Redis/KV-backed with an in-memory
// fallback). Re-exported here so existing imports from "@/lib/middleware"
// keep working; all limit functions are now async (await them).
export {
  checkRateLimit,
  peekRateLimit,
  resetRateLimit,
  safeCheckRateLimit,
  safePeekRateLimit,
  addRateLimitHeaders,
  LOGIN_RATE_LIMIT,
  ORDER_CREATE_RATE_LIMIT,
  PUBLIC_READ_RATE_LIMIT,
  ADMIN_RATE_LIMIT,
  enforceAdminRateLimit,
  redisRateLimitConfigured,
} from "./rate-limit";

/**
 * Parse pagination from URL search params
 */
export function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
  );
  return { page, limit, skip: (page - 1) * limit };
}

/**
 * Parse sort from URL search params
 */
export function parseSort(
  searchParams: URLSearchParams,
  allowedFields: string[] = ["createdAt", "name", "price"]
): Record<string, "asc" | "desc"> {
  const sortBy = searchParams.get("sort") || "createdAt";
  const sortOrder = (searchParams.get("order") || "desc") as "asc" | "desc";

  if (!allowedFields.includes(sortBy)) {
    return { createdAt: "desc" };
  }

  return { [sortBy]: sortOrder };
}
