import { NextRequest } from "next/server";
import { stockAlertService } from "@/lib/services";
import { successResponse, errorResponse } from "@/lib/errors";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const alert = await stockAlertService.markAsRead(id);
    return Response.json(successResponse(alert));
  } catch (error) {
    return Response.json(errorResponse(error as any), {
      status: (error as any).statusCode || 500,
    });
  }
}
