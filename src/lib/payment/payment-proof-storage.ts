import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase";

export const PAYMENT_PROOF_BUCKET = "payment-proofs";
export const PAYMENT_PROOF_MAX_BYTES = 5 * 1024 * 1024;
export const PAYMENT_PROOF_SIGNED_URL_TTL_SECONDS = 15 * 60;
export const PAYMENT_PROOF_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export function hasValidPaymentProofSignature(mimeType: string, bytes: Uint8Array): boolean {
  if (mimeType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return bytes.length >= 8 && bytes.slice(0, 8).every((value, index) => value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index]);
  }
  if (mimeType === "image/webp") {
    return bytes.length >= 12 &&
      new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
      new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  }
  if (mimeType === "image/avif") {
    if (bytes.length < 12 || new TextDecoder().decode(bytes.slice(4, 8)) !== "ftyp") return false;
    const brands = new TextDecoder().decode(bytes.slice(8, Math.min(bytes.length, 64)));
    return brands.includes("avif") || brands.includes("avis");
  }
  return false;
}

/**
 * Generic image magic-byte validator, shared with the product-image upload
 * route (LOW-3). The historical "PaymentProof" name refers to the original
 * consumer; the check itself is purely about the image format and covers the
 * exact MIME allowlist used by product images (jpeg/png/webp/avif).
 */
export const hasValidImageSignature = hasValidPaymentProofSignature;

export async function uploadPaymentProof(file: File, orderId: string): Promise<string> {
  if (!PAYMENT_PROOF_MIME_TYPES.has(file.type)) {
    throw new Error("Unsupported payment proof type");
  }
  if (file.size <= 0 || file.size > PAYMENT_PROOF_MAX_BYTES) {
    throw new Error("Payment proof must be between 1 byte and 5MB");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasValidPaymentProofSignature(file.type, bytes)) {
    throw new Error("Payment proof content does not match its declared image type");
  }

  if (!/^[A-Za-z0-9_-]{8,64}$/.test(orderId)) {
    throw new Error("Invalid order ID");
  }

  const path = `orders/${orderId}/${crypto.randomUUID()}.${EXTENSIONS[file.type]}`;
  const { error } = await supabaseAdmin.storage
    .from(PAYMENT_PROOF_BUCKET)
    .upload(path, Buffer.from(bytes), {
      contentType: file.type,
      upsert: false,
    });

  if (error) throw new Error(`Payment proof upload failed: ${error.message}`);
  return path;
}

export async function createPaymentProofSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.storage
    .from(PAYMENT_PROOF_BUCKET)
    .createSignedUrl(path, PAYMENT_PROOF_SIGNED_URL_TTL_SECONDS);

  if (error) {
    console.warn("[PaymentProof] Signed URL creation failed:", error.message);
    return null;
  }
  return data?.signedUrl || null;
}

export async function deletePaymentProof(path: string): Promise<void> {
  const { error } = await supabaseAdmin.storage.from(PAYMENT_PROOF_BUCKET).remove([path]);
  if (error) console.warn("[PaymentProof] Cleanup failed:", error.message);
}
