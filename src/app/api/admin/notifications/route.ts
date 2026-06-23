import { NextRequest } from "next/server";
import { notificationRepository } from "@/lib/repositories";
import { parsePagination, parseSort, addRateLimitHeaders, checkRateLimit } from "@/lib/middleware";
import { successResponse, errorResponse } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const { page, limit, skip } = parsePagination(request.nextUrl.searchParams);
    const sort = parseSort(request.nextUrl.searchParams, ["createdAt", "channel", "status"]);

    const result = await notificationRepository.findMany({
      where: {},
      orderBy: sort,
      skip,
      take: limit,
    });

    return Response.json(
      successResponse(result.items, {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      })
    );
  } catch (error) {
    return Response.json(errorResponse(error as any), {
      status: (error as any).statusCode || 500,
    });
  }
}
