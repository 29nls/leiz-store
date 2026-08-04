import { supabaseAdmin } from "@/lib/supabase";
import { generateInvoicePdf } from "./pdf-generator";
import type { InvoiceData, InvoiceResult, Invoice } from "./types";
import { enqueue, processAll, type Job } from "@/lib/queue";
import { invoiceStoragePath, createInvoiceSignedUrl } from "./invoice-storage";

async function generateInvoiceNo(): Promise<string> {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `INV/${datePart}/${randomPart}`;
}

async function getOrderWithItems(orderId: string): Promise<InvoiceData | null> {
  const { data: order, error } = await supabaseAdmin
    .from("order")
    .select("*, order_item(*)")
    .eq("id", orderId)
    .single();

  if (error || !order) {
    console.error("[InvoiceService] Order not found:", orderId, error?.message);
    return null;
  }

  const items = (order.order_item || []).map((item: any) => ({
    name: item.name || "Unknown Product",
    quantity: item.quantity || 1,
    price: Number(item.price) || 0,
    total: Number(item.total) || 0,
  }));

  return {
    invoiceNo: "",
    orderNumber: order.order_number || orderId,
    customerName: order.customer_name || order.customerName || "-",
    customerDiscord: order.customer_discord || order.customerDiscord || undefined,
    customerIGN: order.customer_ign || order.customerIGN || undefined,
    items,
    subtotal: Number(order.subtotal) || 0,
    tax: Number(order.tax) || 0,
    discount: Number(order.discount) || 0,
    total: Number(order.total) || 0,
    currency: order.currency || "IDR",
    paymentMethod: order.payment_method || order.paymentMethod || "-",
    paymentRef: order.payment_ref || order.paymentRef || undefined,
    createdAt: order.created_at || order.createdAt || new Date().toISOString(),
    paidAt: order.paid_at || order.paidAt || undefined,
    storeName: "LEIZ STORE",
  };
}

async function uploadPdfToStorage(
  pdfBuffer: Buffer,
  pdfFilename: string
): Promise<{ path: string; url: string | null } | null> {
  try {
    const bucket = process.env.INVOICE_STORAGE_BUCKET || "invoices";
    const storagePath = invoiceStoragePath(pdfFilename.replace(/^invoice-/, "").replace(/\.pdf$/i, ""));
    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucket)
      .upload(storagePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (!uploadError) {
      return { path: storagePath, url: await createInvoiceSignedUrl(storagePath) };
    }
    console.warn("[InvoiceService] PDF upload failed:", uploadError.message);
  } catch (err) {
    console.warn("[InvoiceService] Storage error (non-fatal):", err);
  }
  return null;
}

export async function generateAndSendInvoice(orderId: string): Promise<InvoiceResult> {
  const { data: existing } = await supabaseAdmin
    .from("invoice")
    .select("*")
    .eq("order_id", orderId)
    .maybeSingle();

  if (existing?.status === "SENT") {
    return { success: true, invoiceNo: existing.invoice_no };
  }
  if (existing?.status === "FAILED") {
    return { success: false, invoiceNo: existing.invoice_no, error: "Previous attempt failed, retry explicitly" };
  }

  const invoiceData = await getOrderWithItems(orderId);
  if (!invoiceData) return { success: false, error: "Order not found" };

  const invoiceNo = existing?.invoice_no || await generateInvoiceNo();
  invoiceData.invoiceNo = invoiceNo;
  const invoiceId = existing?.id || crypto.randomUUID();

  if (!existing) {
    const { error: insertError } = await supabaseAdmin.from("invoice").insert({
      id: invoiceId,
      order_id: orderId,
      invoice_no: invoiceNo,
      status: "PENDING",
    });
    if (insertError && insertError.code !== "23505") {
      console.error("[InvoiceService] Insert failed:", insertError.message);
      return { success: false, error: "Failed to create invoice" };
    }
  } else {
    await supabaseAdmin.from("invoice").update({
      status: "PENDING",
      error_log: null,
      updated_at: new Date().toISOString(),
    }).eq("id", invoiceId);
  }

  try {
    const pdfBuffer = await generateInvoicePdf(invoiceData);
    const storedPdf = await uploadPdfToStorage(pdfBuffer, `invoice-${invoiceNo}.pdf`);
    if (!storedPdf) throw new Error("Invoice PDF could not be uploaded");
    const invoiceUpdate = {
      pdf_path: storedPdf.path,
      ...(storedPdf.url ? { pdf_url: storedPdf.url } : {}),
      status: "SENT",
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      error_log: null,
    };
    let { error: updateError } = await supabaseAdmin.from("invoice").update(invoiceUpdate).eq("id", invoiceId);
    if (updateError?.message.toLowerCase().includes("pdf_path")) {
      // Compatibility with installations that have not applied migration 007.
      const { pdf_path: _ignored, ...legacyUpdate } = invoiceUpdate;
      ({ error: updateError } = await supabaseAdmin.from("invoice").update(legacyUpdate).eq("id", invoiceId));
    }
    if (updateError) throw updateError;
    return { success: true, invoiceNo };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await supabaseAdmin.from("invoice").update({
      status: "FAILED",
      error_log: JSON.stringify([msg]),
      updated_at: new Date().toISOString(),
    }).eq("id", invoiceId);
    return { success: false, invoiceNo, error: msg };
  }
}

/** Queue an invoice job; processing is performed by the cron worker. */
export async function queueInvoice(orderId: string): Promise<boolean> {
  return Boolean(await enqueue("GENERATE_INVOICE", { orderId }, {
    priority: 10,
    maxRetries: 5,
    dedupeKey: `invoice:${orderId}`,
  }));
}

async function handleJob(job: Job): Promise<boolean> {
  if (job.type !== "GENERATE_INVOICE") return true;
  const orderId = typeof job.payload.orderId === "string" ? job.payload.orderId : "";
  if (!orderId) return false;
  const result = await generateAndSendInvoice(orderId);
  return result.success;
}

export async function processPendingJobs(maxJobs = 10): Promise<number> {
  return processAll(handleJob, ["GENERATE_INVOICE"], Math.max(1, Math.min(maxJobs, 100)));
}

export async function getInvoiceByOrder(orderId: string): Promise<Invoice | null> {
  const { data } = await supabaseAdmin.from("invoice").select("*").eq("order_id", orderId).maybeSingle();
  return data || null;
}

export async function listInvoices(options: {
  page?: number; limit?: number; status?: string;
}): Promise<{ items: Invoice[]; total: number; page: number; totalPages: number }> {
  const { page = 1, limit = 20, status } = options;
  const from = (page - 1) * limit;
  let query = supabaseAdmin.from("invoice").select("*, order:order(order_number, customer_name, total, currency)", { count: "exact" });
  if (status) query = query.eq("status", status);
  query = query.order("created_at", { ascending: false }).range(from, from + limit - 1);
  const { data, error, count } = await query;
  if (error) return { items: [], total: 0, page, totalPages: 0 };
  return { items: (data || []) as unknown as Invoice[], total: count || 0, page, totalPages: Math.ceil((count || 0) / limit) };
}

export async function resendInvoice(invoiceId: string): Promise<boolean> {
  const { data: invoice } = await supabaseAdmin.from("invoice").select("*").eq("id", invoiceId).single();
  if (!invoice) return false;
  const result = await generateAndSendInvoice(invoice.order_id);
  return result.success;
}
