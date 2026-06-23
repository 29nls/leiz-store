import { NextRequest } from "next/server";
import { recommendationService } from "@/lib/services";
import { recommendationRepository } from "@/lib/repositories";
import { successResponse, errorResponse } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const result = await recommendationRepository.findMany({
      where: {},
      orderBy: { score: "desc" },
      skip: 0,
      take: 50,
      include: {},
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
    const result = await recommendationService.generateRecommendations();
    return Response.json(successResponse(result));
  } catch (error) {
    return Response.json(errorResponse(error as any), {
      status: (error as any).statusCode || 500,
    });
  }
}
