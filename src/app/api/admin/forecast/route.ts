import { NextRequest } from "next/server";
import { forecastService } from "@/lib/services";
import { successResponse, errorResponse } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const forecasts = await forecastService.getLatestForecasts(undefined);
    return Response.json(successResponse(forecasts));
  } catch (error) {
    return Response.json(errorResponse(error as any), {
      status: (error as any).statusCode || 500,
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await forecastService.generateForecasts();
    return Response.json(successResponse(result));
  } catch (error) {
    return Response.json(errorResponse(error as any), {
      status: (error as any).statusCode || 500,
    });
  }
}
