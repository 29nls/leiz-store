import { NextRequest } from "next/server";
import { customerSegmentService } from "@/lib/services";
import { successResponse, errorResponse } from "@/lib/errors";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ segment: string }> }
) {
  try {
    const { segment } = await params;
    const customers = await customerSegmentService.getCustomersBySegment(segment);
    return Response.json(successResponse(customers));
  } catch (error) {
    return Response.json(errorResponse(error as any), {
      status: (error as any).statusCode || 500,
    });
  }
}
