/**
 * Rate limiting backed by Redis/KV with an in-memory fallback.
 *
 * Storage migration from the previous in-memory-only Map (agenda item in
 * docs/api-specification.md §9): when `KV_REST_API_URL` + `KV_REST_API_TOKEN`
 * (Vercel KV) or `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
 * (Upstash Redis) are configured, the limiter is shared across all serverless
 * instances. Otherwise it falls back to a per-instance Map so local dev and
 * tests work without any external service.
 *
 * The Redis/KV client speaks the REST protocol shared by Upstash and Vercel KV
 * (POST /<COMMAND> with a JSON-array body) — no extra dependency is required.
 *
 * All `safe*` wrappers and `enforceAdminRateLimit` fail open: a limiter (or
 * Redis) failure must never block legitimate traffic.
 */

import { NextResponse } from "next/server";
import { errorResponse, RateLimitError } from "@/lib/errors";

// ─── Types ──────────────────────────────────────────────────

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

interface RateLimitStore {
  incr(key: string, ttlMs: number): Promise<{ count: number; resetAt: number }>;
  peek(key: string): Promise<{ count: number; resetAt: number }>;
  del(key: string): Promise<void>;
}

// ─── In-memory fallback store ───────────────────────────────

const memoryStore = new Map<string, { count: number; resetAt: number }>();

const memoryStoreImpl: RateLimitStore = {
  async incr(key, ttlMs) {
    const now = Date.now();
    const entry = memoryStore.get(key);
    if (!entry || now > entry.resetAt) {
      const resetAt = now + ttlMs;
      memoryStore.set(key, { count: 1, resetAt });
      return { count: 1, resetAt };
    }
    entry.count++;
    return { count: entry.count, resetAt: entry.resetAt };
  },
  async peek(key) {
    const now = Date.now();
    const entry = memoryStore.get(key);
    if (!entry || now > entry.resetAt) return { count: 0, resetAt: now };
    return { count: entry.count, resetAt: entry.resetAt };
  },
  async del(key) {
    memoryStore.delete(key);
  },
};

// ─── Redis/KV store (REST protocol, Upstash & Vercel KV) ─────

function redisBaseUrl(): string | null {
  return process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || null;
}

function redisToken(): string | null {
  return process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || null;
}

export function redisRateLimitConfigured(): boolean {
  return Boolean(redisBaseUrl() && redisToken());
}

/** Execute one Redis/KV command over REST; throws on transport/command error. */
async function redisCommand(command: string, args: (string | number)[]): Promise<unknown> {
  const base = redisBaseUrl();
  const token = redisToken();
  if (!base || !token) {
    throw new Error("Redis/KV rate-limit store is not configured");
  }

  const res = await fetch(`${base.replace(/\/+$/, "")}/${command}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });

  if (!res.ok) {
    throw new Error(`Rate-limit KV ${command} failed with status ${res.status}`);
  }

  const json = (await res.json()) as { result?: unknown; error?: string };
  if (json.error) throw new Error(json.error);
  return json.result;
}

const redisStore: RateLimitStore = {
  async incr(key, ttlMs) {
    // Fixed window: INCR, and EXPIRE only on the first hit so the window is
    // anchored to the first request rather than sliding on every request.
    const count = Number(await redisCommand("INCR", [key]));
    if (count === 1) {
      await redisCommand("EXPIRE", [key, Math.max(1, Math.ceil(ttlMs / 1000))]);
    }
    const ttlMsRemaining = Number(await redisCommand("PTTL", [key]));
    const resetAt = ttlMsRemaining > 0 ? Date.now() + ttlMsRemaining : Date.now() + ttlMs;
    return { count, resetAt };
  },
  async peek(key) {
    const raw = await redisCommand("GET", [key]);
    const count = raw == null ? 0 : Number(raw);
    const ttlMsRemaining = Number(await redisCommand("PTTL", [key]));
    return { count, resetAt: ttlMsRemaining > 0 ? Date.now() + ttlMsRemaining : Date.now() };
  },
  async del(key) {
    await redisCommand("DEL", [key]);
  },
};

/** Pick the active store lazily so env changes (and tests) are honored per call. */
function getStore(): RateLimitStore {
  return redisRateLimitConfigured() ? redisStore : memoryStoreImpl;
}

// ─── Rate limit primitives (async) ──────────────────────────

export async function checkRateLimit(
  key: string,
  maxRequests = 100,
  windowMs = 60000
): Promise<RateLimitResult> {
  const { count, resetAt } = await getStore().incr(key, windowMs);
  if (count > maxRequests) {
    return { allowed: false, remaining: 0, resetAt };
  }
  return { allowed: true, remaining: Math.max(0, maxRequests - count), resetAt };
}

/** Read a bucket without incrementing it. */
export async function peekRateLimit(
  key: string,
  maxRequests = 100,
  windowMs = 60000
): Promise<RateLimitResult> {
  const { count, resetAt } = await getStore().peek(key);
  if (count === 0) {
    return { allowed: true, remaining: maxRequests, resetAt: Date.now() + windowMs };
  }
  return {
    allowed: count < maxRequests,
    remaining: Math.max(0, maxRequests - count),
    resetAt,
  };
}

/** Delete a bucket (e.g. clear the failure counter after a successful login). */
export async function resetRateLimit(key: string): Promise<void> {
  await getStore().del(key);
}

/** Fail-open wrapper: a limiter bug must never block legitimate traffic. */
export async function safeCheckRateLimit(
  key: string,
  maxRequests = 100,
  windowMs = 60000
): Promise<RateLimitResult> {
  try {
    return await checkRateLimit(key, maxRequests, windowMs);
  } catch (err) {
    console.error("[rate-limit] checkRateLimit failed open:", err);
    return { allowed: true, remaining: maxRequests, resetAt: Date.now() + windowMs };
  }
}

/** Fail-open peek (see safeCheckRateLimit). */
export async function safePeekRateLimit(
  key: string,
  maxRequests = 100,
  windowMs = 60000
): Promise<RateLimitResult> {
  try {
    return await peekRateLimit(key, maxRequests, windowMs);
  } catch (err) {
    console.error("[rate-limit] peekRateLimit failed open:", err);
    return { allowed: true, remaining: maxRequests, resetAt: Date.now() + windowMs };
  }
}

/**
 * Add rate limit headers to response.
 */
export function addRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult,
  limit = 100
): NextResponse {
  response.headers.set("X-RateLimit-Limit", String(limit));
  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  response.headers.set("X-RateLimit-Reset", String(Math.ceil(result.resetAt / 1000)));
  return response;
}

// ─── Presets ────────────────────────────────────────────────

// Login & order-create throttling. Generous, fail-open thresholds (see MED-2
// in docs/security-audit-report.md). Windows auto-expire: there is no permanent
// lockout, and every limiter call goes through the fail-open safe* wrappers so
// a limiter bug can never block legitimate traffic.
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

/** Per-IP throttle for public catalog reads (products list/detail). */
export const PUBLIC_READ_RATE_LIMIT = {
  /** Requests allowed per client IP per route per window. Generous: catalog
   *  pages legitimately issue several requests (pagination, filters, image
   *  prefetch), so keep headroom over a normal browsing session. */
  max: 60,
  windowMs: 60 * 1000,
} as const;

/** Generic per-IP throttle for every /api/admin/* route (per route, per window). */
export const ADMIN_RATE_LIMIT = {
  /** Requests allowed per client IP per route per window. */
  max: 120,
  windowMs: 60 * 1000,
} as const;

// ─── Admin route guard ──────────────────────────────────────

/**
 * Enforce the generic admin rate limit for one route. Returns a 429 response
 * (with X-RateLimit-* headers) when the caller is over the cap, or `null` to
 * let the request continue. Always fails open.
 */
export async function enforceAdminRateLimit(
  request: Request,
  route: string
): Promise<NextResponse | null> {
  try {
    const forwarded = request.headers?.get("x-forwarded-for");
    const ip =
      forwarded?.split(",")[0]?.trim() ||
      request.headers?.get("x-real-ip")?.trim() ||
      "unknown";
    const key = `admin:${route}:${ip}`;
    const result = await safeCheckRateLimit(key, ADMIN_RATE_LIMIT.max, ADMIN_RATE_LIMIT.windowMs);
    if (result.allowed) return null;

    const response = NextResponse.json(errorResponse(new RateLimitError()), { status: 429 });
    return addRateLimitHeaders(response, result, ADMIN_RATE_LIMIT.max);
  } catch (err) {
    // Fail-open: never block admin traffic because of a limiter bug.
    console.error(`[rate-limit] enforceAdminRateLimit failed open (${route}):`, err);
    return null;
  }
}
