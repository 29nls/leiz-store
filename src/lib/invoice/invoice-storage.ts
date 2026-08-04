import { supabaseAdmin } from "@/lib/supabase";

export const INVOICE_SIGNED_URL_TTL_SECONDS = 15 * 60;

export function invoiceStoragePath(invoiceNo: string): string {
  const safeInvoiceNo = invoiceNo.replace(/[^A-Za-z0-9_-]+/g, "-");
  return `invoices/invoice-${safeInvoiceNo}.pdf`;
}

export async function createInvoiceSignedUrl(storagePath: string): Promise<string | null> {
  const bucket = process.env.INVOICE_STORAGE_BUCKET || "invoices";
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(storagePath, INVOICE_SIGNED_URL_TTL_SECONDS);

  if (error) {
    console.warn("[InvoiceStorage] Signed URL creation failed:", error.message);
    return null;
  }
  return data?.signedUrl || null;
}
