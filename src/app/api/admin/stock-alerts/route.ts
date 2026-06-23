import { NextRequest } from "next/server";
import { stockAlertService } from "@/lib/services";
import { stockAlertRepository } from "@/lib/repositories";
import { successResponse, errorResponse } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const result = await stockAlertRepository.findMany({
      where: {},
      orderBy: { createdAt: "desc" },
      skip: 0,
      take: 100,
    });
    return Response.json(successResponse(result));
  } catch (error) {
    return Response.json(errorResponse(error as any), {
      status: (error as any).statusCode || 500,
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const alerts = await stockAlertService.checkAndCreateAlerts(undefined);
    return Response.json(successResponse(alerts));
  } catch (error) {
    return Response.json(errorResponse(error as any), {
      status: (error as any).statusCode || 500,
    });
  }
}
