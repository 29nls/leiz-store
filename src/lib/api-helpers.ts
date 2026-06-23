/**
 * API Helpers
 * Next.js-specific route handler utilities
 */

import { NextRequest, NextResponse } from "next/server";
import { AppError, errorResponse } from "@/lib/errors";

export type RouteHandler = (
  req: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => Promise<NextResponse>;

export function withErrorHandling(handler: RouteHandler): RouteHandler {
  return async (req, context) => {
    try {
      return await handler(req, context);
    } catch (error) {
      if (error instanceof AppError) {
        return NextResponse.json(errorResponse(error), {
          status: error.statusCode,
        });
      }
      console.error("Unhandled error:", error);
      return NextResponse.json(
        errorResponse(new AppError(500, "INTERNAL_ERROR", "Internal server error")),
        { status: 500 }
      );
    }
  };
}

// ─── CORS ───────────────────────────────────────────────────

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

export function handleCors(request: NextRequest): NextResponse | null {
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders(request.headers.get("origin") || undefined),
    });
  }
  return null;
}
