import { supabaseAdmin } from "@/lib/supabase";
import { EMAIL_PATTERN } from "@/lib/validators/order";
import { generateInvoicePdf } from "./pdf-generator";
import { sendInvoiceEmail, isEmailConfigured, buildInvoiceEmailHtml } from "./email-sender";
import { InvoiceEmailStatus, type InvoiceData, type InvoiceResult, type Invoice } from "./types";
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
    customerEmail: order.customer_email || order.customerEmail || undefined,
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

/** Persist the email delivery sub-state on the invoice row. */
async function updateInvoiceEmailState(
  invoiceId: string,
  patch: {
    email_status: InvoiceEmailStatus;
    sent_via_email?: boolean;
    error_log?: string | null;
  }
): Promise<void> {
  await supabaseAdmin.from("invoice").update({
    ...patch,
    updated_at: new Date().toISOString(),
  }).eq("id", invoiceId);
}

/**
 * Deliver the invoice PDF to the buyer's email. The outcome is recorded on the
 * invoice row (email_status / sent_via_email) and mirrored in the result.
 *
 * - SENT:    SMTP accepted the message.
 * - SKIPPED: no buyer email on the order, or SMTP not configured. Terminal —
 *            retrying will not change anything, so the job must NOT be
 *            re-queued; the admin resend button remains available.
 * - FAILED:  SMTP send threw. Retryable via queue backoff + admin resend.
 */
async function deliverInvoiceEmail(options: {
  invoiceId: string;
  invoiceData: InvoiceData;
  pdfBuffer: Buffer;
  invoiceNo: string;
}): Promise<InvoiceResult> {
  const { invoiceId, invoiceData, pdfBuffer, invoiceNo } = options;
  const recipient = invoiceData.customerEmail?.trim().toLowerCase();

  if (!recipient) {
    // Loud, explicit signal — never a silent success.
    console.warn(
      `[InvoiceEmail] No buyer email for order ${invoiceData.orderNumber} — invoice ${invoiceNo} NOT emailed`
    );
    await updateInvoiceEmailState(invoiceId, {
      email_status: InvoiceEmailStatus.SKIPPED,
      error_log: JSON.stringify(["No customer email on order"]),
    });
    return { success: false, invoiceNo, emailStatus: InvoiceEmailStatus.SKIPPED };
  }

  // Re-validate even when the order predates checkout validation: a malformed
  // address (e.g. containing CRLF) must never reach the SMTP envelope.
  if (!EMAIL_PATTERN.test(recipient)) {
    console.warn(
      `[InvoiceEmail] Invalid buyer email for order ${invoiceData.orderNumber} — invoice ${invoiceNo} NOT emailed`
    );
    await updateInvoiceEmailState(invoiceId, {
      email_status: InvoiceEmailStatus.SKIPPED,
      error_log: JSON.stringify(["Invalid customer email on order"]),
    });
    return { success: false, invoiceNo, emailStatus: InvoiceEmailStatus.SKIPPED };
  }

  if (!isEmailConfigured()) {
    // Loud, explicit signal — never a silent success. SMTP is unconfigured, so
    // this is permanent until the operator adds the BREVO_* variables.
    console.warn(
      `[InvoiceEmail] SMTP not configured — invoice ${invoiceNo} NOT emailed to ${recipient}. ` +
      "Set BREVO_SMTP_HOST/PORT/USER/PASS and BREVO_FROM_EMAIL."
    );
    await updateInvoiceEmailState(invoiceId, {
      email_status: InvoiceEmailStatus.SKIPPED,
      error_log: JSON.stringify(["SMTP not configured (BREVO_SMTP_*/BREVO_FROM_EMAIL)"]),
    });
    return { success: false, invoiceNo, emailStatus: InvoiceEmailStatus.SKIPPED };
  }

  try {
    await sendInvoiceEmail({
      to: recipient,
      subject: `Invoice ${invoiceNo} — ${invoiceData.storeName || "LEIZ STORE"}`,
      html: buildInvoiceEmailHtml(invoiceData),
      // invoiceNo contains slashes (INV/yyyy/mm/xxxxx); sanitize for the
      // attachment display name.
      pdfFilename: `invoice-${invoiceNo.replace(/[^A-Za-z0-9_-]+/g, "-")}.pdf`,
      pdfBuffer,
    });
    await updateInvoiceEmailState(invoiceId, {
      email_status: InvoiceEmailStatus.SENT,
      sent_via_email: true,
      error_log: null,
    });
    console.log(`[InvoiceEmail] Invoice ${invoiceNo} emailed to ${recipient}`);
    return { success: true, invoiceNo, emailStatus: InvoiceEmailStatus.SENT };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown email error";
    // Do NOT mark the invoice as delivered: the email was not sent. The queue
    // retries the job and the admin can resend manually.
    console.error(`[InvoiceEmail] Send failed for ${invoiceNo} (${recipient}):`, msg);
    await updateInvoiceEmailState(invoiceId, {
      email_status: InvoiceEmailStatus.FAILED,
      error_log: JSON.stringify([msg]),
    });
    return { success: false, invoiceNo, emailStatus: InvoiceEmailStatus.FAILED, error: msg };
  }
}

export async function generateAndSendInvoice(orderId: string): Promise<InvoiceResult> {
  const { data: existing } = await supabaseAdmin
    .from("invoice")
    .select("*")
    .eq("order_id", orderId)
    .maybeSingle();

  // Idempotency guard, ordered AFTER the email step: an invoice only counts as
  // fully delivered when the PDF is uploaded AND the email was actually sent.
  // A SENT invoice whose email was SKIPPED or FAILED falls through so queue
  // retries and the admin resend button genuinely re-run the pipeline.
  if (existing?.status === "SENT" && existing?.email_status === InvoiceEmailStatus.SENT) {
    return { success: true, invoiceNo: existing.invoice_no, emailStatus: InvoiceEmailStatus.SENT };
  }
  // No FAILED early-return: a previous failed attempt must be retried by the
  // queue and by the admin resend endpoint.

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
    // Reset for (re)processing: covers status FAILED and SENT-with-email-
    // skipped/failed retries. invoice_no and pdf_path are preserved.
    await supabaseAdmin.from("invoice").update({
      status: "PENDING",
      email_status: "PENDING",
      sent_via_email: false,
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

    return await deliverInvoiceEmail({ invoiceId, invoiceData, pdfBuffer, invoiceNo });
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

/**
 * SKIPPED is terminal: completing the job avoids a retry storm while SMTP is
 * unconfigured or the order has no buyer email. Real send failures (FAILED)
 * return false and are retried with backoff by the queue.
 */
function isTerminalSuccess(result: InvoiceResult): boolean {
  return result.success || result.emailStatus === InvoiceEmailStatus.SKIPPED;
}

async function handleJob(job: Job): Promise<boolean> {
  if (job.type !== "GENERATE_INVOICE") return true;
  const orderId = typeof job.payload.orderId === "string" ? job.payload.orderId : "";
  if (!orderId) return false;
  const result = await generateAndSendInvoice(orderId);
  return isTerminalSuccess(result);
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
  // SKIPPED is a valid terminal state (no buyer email / SMTP unconfigured),
  // so treat it as a handled resend rather than a failure.
  return isTerminalSuccess(result);
}
