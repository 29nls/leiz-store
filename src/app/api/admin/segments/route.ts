import { NextRequest } from "next/server";
import { customerSegmentService } from "@/lib/services";
import { successResponse, errorResponse } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const segments = await customerSegmentService.getSegmentCounts();
    return Response.json(successResponse(segments));
  } catch (error) {
    return Response.json(errorResponse(error as any), {
      status: (error as any).statusCode || 500,
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await customerSegmentService.calculateSegments();
    return Response.json(successResponse(result));
  } catch (error) {
    return Response.json(errorResponse(error as any), {
      status: (error as any).statusCode || 500,
    });
  }
}
