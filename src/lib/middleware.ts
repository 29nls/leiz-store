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
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
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
 * Extract client IP from request
 */
export function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Extract user agent
 */
export function getUserAgent(request: NextRequest): string {
  return request.headers.get("user-agent") || "unknown";
}

/**
 * Rate limiting with in-memory store (production should use Redis)
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  maxRequests = 100,
  windowMs = 60000
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  entry.count++;

  if (entry.count > maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Add rate limit headers to response
 */
export function addRateLimitHeaders(
  response: NextResponse,
  result: ReturnType<typeof checkRateLimit>
): NextResponse {
  response.headers.set("X-RateLimit-Limit", "100");
  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  response.headers.set("X-RateLimit-Reset", String(Math.ceil(result.resetAt / 1000)));
  return response;
}

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
