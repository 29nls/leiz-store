import { NextRequest } from "next/server";
import { activityLogRepository } from "@/lib/repositories";
import { parsePagination, parseSort } from "@/lib/middleware";
import { successResponse, errorResponse } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const { page, limit, skip } = parsePagination(request.nextUrl.searchParams);
    const sort = parseSort(request.nextUrl.searchParams, ["createdAt", "action"]);
    const action = request.nextUrl.searchParams.get("action") || undefined;
    const entity = request.nextUrl.searchParams.get("entity") || undefined;

    const where: Record<string, string> = {};
    if (action) where.action = action;
    if (entity) where.entity = entity;

    const result = await activityLogRepository.findMany({
      where,
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
