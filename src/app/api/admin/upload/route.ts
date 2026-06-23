import { NextRequest } from "next/server";
import { storageService, generateProductImageKey } from "@/lib/storage";
import { successResponse, errorResponse } from "@/lib/errors";

export async function POST(request: NextRequest) {
  try {
    if (!storageService.isConfigured()) {
      return Response.json(
        errorResponse(new Error("S3 storage not configured") as any),
        { status: 503 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const productId = formData.get("productId") as string;
    const index = parseInt(formData.get("index") as string || "0", 10);

    if (!file || !productId) {
      return Response.json(
        errorResponse(new Error("file and productId are required") as any),
        { status: 400 }
      );
    }

    // Validate file type
    const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
    if (!ALLOWED_TYPES.includes(file.type)) {
      return Response.json(
        errorResponse(new Error(`Invalid file type: ${file.type}. Allowed: ${ALLOWED_TYPES.join(", ")}`) as any),
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return Response.json(
        errorResponse(new Error(`File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Max: 5MB`) as any),
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const key = generateProductImageKey(productId, file.name, index);

    const result = await storageService.uploadFile({
      key,
      contentType: file.type,
      body: buffer,
      isPublic: true,
      cacheControl: "public, max-age=31536000, immutable",
    });

    return Response.json(successResponse(result));
  } catch (error) {
    return Response.json(errorResponse(error as any), {
      status: (error as any).statusCode || 500,
    });
  }
}
