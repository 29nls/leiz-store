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

// ─── Login & order-create throttling ─────────────────────────
// Generous, fail-open thresholds (see MED-2 in docs/security-audit-report.md).
// Windows auto-expire: there is no permanent lockout, and every limiter call
// in the routes below goes through the fail-open safe* wrappers so a limiter
// bug can never block legitimate traffic.

export const LOGIN_RATE_LIMIT = {
  /** Failed attempts allowed per client IP per window. */
  ipMax: 20,
  /** Failed attempts allowed per account per window — backstop against IP rotation. */
  accountMax: 10,
  windowMs: 15 * 60 * 1000,
} as const;

export const ORDER_CREATE_RATE_LIMIT = {
  /** Orders allowed per client IP per window. Generous so NAT-shared legitimate buyers are unaffected. */
  max: 20,
  windowMs: 60 * 1000,
} as const;

/** Read a bucket without incrementing it. */
export function peekRateLimit(
  key: string,
  maxRequests = 100,
  windowMs = 60000
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  if (!entry || now > entry.resetAt) {
    return { allowed: true, remaining: maxRequests, resetAt: now + windowMs };
  }
  return {
    allowed: entry.count < maxRequests,
    remaining: Math.max(0, maxRequests - entry.count),
    resetAt: entry.resetAt,
  };
}

/** Delete a bucket (e.g. clear the failure counter after a successful login). */
export function resetRateLimit(key: string): void {
  rateLimitStore.delete(key);
}

/** Fail-open wrapper: a limiter bug must never block legitimate traffic. */
export function safeCheckRateLimit(
  key: string,
  maxRequests = 100,
  windowMs = 60000
): { allowed: boolean; remaining: number; resetAt: number } {
  try {
    return checkRateLimit(key, maxRequests, windowMs);
  } catch (err) {
    console.error("[rate-limit] checkRateLimit failed open:", err);
    return { allowed: true, remaining: maxRequests, resetAt: Date.now() + windowMs };
  }
}

/** Fail-open peek (see safeCheckRateLimit). */
export function safePeekRateLimit(
  key: string,
  maxRequests = 100,
  windowMs = 60000
): { allowed: boolean; remaining: number; resetAt: number } {
  try {
    return peekRateLimit(key, maxRequests, windowMs);
  } catch (err) {
    console.error("[rate-limit] peekRateLimit failed open:", err);
    return { allowed: true, remaining: maxRequests, resetAt: Date.now() + windowMs };
  }
}

/**
 * Add rate limit headers to response
 */
export function addRateLimitHeaders(
  response: NextResponse,
  result: ReturnType<typeof checkRateLimit>,
  limit = 100
): NextResponse {
  response.headers.set("X-RateLimit-Limit", String(limit));
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
