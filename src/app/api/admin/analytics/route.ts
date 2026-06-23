import { NextRequest } from "next/server";
import { analyticsService } from "@/lib/services";
import { successResponse, errorResponse } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const storeId = undefined;
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (startDate && endDate) {
      const data = await analyticsService.getRevenueChart(
        new Date(startDate),
        new Date(endDate),
        storeId
      );
      return Response.json(successResponse(data));
    }

    const stats = await analyticsService.getDashboardStats(storeId);
    return Response.json(successResponse(stats));
  } catch (error) {
    return Response.json(errorResponse(error as any), {
      status: (error as any).statusCode || 500,
    });
  }
}
