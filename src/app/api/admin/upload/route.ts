import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";
import {
  successResponse,
  errorResponse,
  AppError,
  UnauthorizedError,
  ValidationError,
} from "@/lib/errors";
import { uploadFileSchema, zodErrorMessages, MAX_UPLOAD_SIZE } from "@/lib/validators/admin";
import { enforceAdminRateLimit } from "@/lib/rate-limit";
import { hasValidImageSignature } from "@/lib/payment/payment-proof-storage";

// z.instanceof(File) memerlukan global File — pastikan runtime Node (bukan edge).
export const runtime = "nodejs";

async function checkAuth() {
  return isAdminRequest();
}

const BUCKET = "product-images";
const MAX_SIZE = MAX_UPLOAD_SIZE; // 5MB

export async function POST(request: Request) {
  const limited = await enforceAdminRateLimit(request, "upload");
  if (limited) return limited;

  if (!(await checkAuth())) {
    return NextResponse.json(errorResponse(new UnauthorizedError()), { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    const parsed = uploadFileSchema.safeParse({ file });
    if (!parsed.success) {
      return NextResponse.json(
        errorResponse(new ValidationError(zodErrorMessages(parsed.error))),
        { status: 400 }
      );
    }

    const validFile = parsed.data.file;

    const ext = validFile.type.split("/")[1] || "png";
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filePath = `products/${fileName}`;

    const buffer = Buffer.from(await validFile.arrayBuffer());

    // Fail-closed magic-byte check (LOW-3): verify the content matches the
    // declared image type instead of trusting the client-sent MIME type, so
    // the public bucket can never serve a polyglot/HTML-as-image. Same
    // validation as payment-proof uploads (covers all ALLOWED_IMAGE_TYPES).
    if (!hasValidImageSignature(validFile.type, buffer)) {
      return NextResponse.json(
        errorResponse(
          new ValidationError("Konten file tidak sesuai dengan tipe yang dideklarasikan")
        ),
        { status: 400 }
      );
    }

    // Ensure bucket exists
    const { data: buckets } = await supabaseAdmin.storage.listBuckets();
    const bucketExists = buckets?.some((b) => b.name === BUCKET);
    if (!bucketExists) {
      await supabaseAdmin.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: MAX_SIZE,
      });
    }

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(filePath, buffer, {
        contentType: validFile.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        errorResponse(new AppError(500, "UPLOAD_FAILED", "Gagal upload: " + uploadError.message)),
        { status: 500 }
      );
    }

    const { data: publicUrl } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(filePath);

    return NextResponse.json(successResponse({ url: publicUrl.publicUrl }));
  } catch (e: any) {
    const message = e instanceof Error ? e.message : "Terjadi kesalahan";
    return NextResponse.json(
      errorResponse(new AppError(500, "INTERNAL_ERROR", message)),
      { status: 500 }
    );
  }
}
