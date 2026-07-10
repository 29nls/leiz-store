/**
 * API Helpers
 * Next.js-specific route handler utilities
 */

import { NextRequest, NextResponse } from "next/server";
import { AppError, errorResponse } from "@/lib/errors";

export type RouteHandler = (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
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
