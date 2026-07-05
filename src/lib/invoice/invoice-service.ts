import { supabaseAdmin } from "@/lib/supabase";
import { generateInvoicePdf } from "./pdf-generator";
import { sendInvoiceEmail, buildInvoiceEmailHtml } from "./email-sender";
import { sendInvoiceWhatsApp, buildWhatsAppMessage } from "./whatsapp-sender";
import { enqueue, processAll, JobType } from "@/lib/queue";
import type { InvoiceData, InvoiceResult, Invoice } from "./types";

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
    customerPhone: order.customer_phone || order.phone || undefined,
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
): Promise<string | null> {
  try {
    const bucket = process.env.INVOICE_STORAGE_BUCKET || "invoices";
    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucket)
      .upload(`invoices/${pdfFilename}`, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (!uploadError) {
      const { data: urlData } = supabaseAdmin.storage
        .from(bucket)
        .getPublicUrl(`invoices/${pdfFilename}`);
      return urlData?.publicUrl || null;
    }
    console.warn(`[InvoiceService] PDF upload failed:`, uploadError.message);
  } catch (err) {
    console.warn(`[InvoiceService] Storage error (non-fatal):`, err);
  }
  return null;
}

export async function generateAndSendInvoice(
  orderId: string
): Promise<InvoiceResult> {
  const { data: existing } = await supabaseAdmin
    .from("invoice")
    .select("id, status, invoice_no, sent_via_email, sent_via_wa")
    .eq("order_id", orderId)
    .maybeSingle();

  if (existing) {
    console.log(`[InvoiceService] Invoice already exists for order ${orderId}: ${existing.invoice_no} (${existing.status})`);
    return {
      success: existing.status === "SENT",
      invoiceNo: existing.invoice_no,
      emailSent: existing.sent_via_email,
      waSent: existing.sent_via_wa,
      error: existing.status === "FAILED" ? "Previous attempt failed, check admin panel to retry" : undefined,
    };
  }

  const invoiceData = await getOrderWithItems(orderId);
  if (!invoiceData) {
    return { success: false, emailSent: false, waSent: false, error: "Order not found" };
  }

  const invoiceNo = await generateInvoiceNo();
  invoiceData.invoiceNo = invoiceNo;

  const invoiceId = crypto.randomUUID();
  const { error: insertError } = await supabaseAdmin
    .from("invoice")
    .insert({
      id: invoiceId,
      order_id: orderId,
      invoice_no: invoiceNo,
      status: "PENDING",
    });

  if (insertError) {
    if (
      insertError.code === "23505" ||
      insertError.message.toLowerCase().includes("duplicate") ||
      insertError.message.toLowerCase().includes("unique")
    ) {
      return { success: false, emailSent: false, waSent: false, error: "Invoice already exists" };
    }
    console.error(`[InvoiceService] Insert failed:`, insertError.message);
    return { success: false, emailSent: false, waSent: false, error: "Failed to create invoice" };
  }

  try {
    const pdfBuffer = await generateInvoicePdf(invoiceData);
    const pdfFilename = `invoice-${invoiceNo}.pdf`;

    const pdfUrl = await uploadPdfToStorage(pdfBuffer, pdfFilename);

    const payload = {
      orderId,
      invoiceId,
      invoiceNo,
      pdfUrl,
    };

    await supabaseAdmin
      .from("invoice")
      .update({
        pdf_url: pdfUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoiceId);

    // Enqueue email and WhatsApp as separate retryable jobs
    if (invoiceData.customerEmail) {
      await enqueue(JobType.SEND_INVOICE_EMAIL, {
        ...payload,
        customerEmail: invoiceData.customerEmail,
        customerName: invoiceData.customerName,
        orderNumber: invoiceData.orderNumber,
        currency: invoiceData.currency,
        total: invoiceData.total,
        items: invoiceData.items,
        createdAt: invoiceData.createdAt,
        paymentMethod: invoiceData.paymentMethod,
        subtotal: invoiceData.subtotal,
        tax: invoiceData.tax,
        discount: invoiceData.discount,
        storeName: invoiceData.storeName,
      }, { maxRetries: 3 });
    }

    if (invoiceData.customerPhone) {
      await enqueue(JobType.SEND_INVOICE_WHATSAPP, {
        ...payload,
        phone: invoiceData.customerPhone,
        orderNumber: invoiceData.orderNumber,
        total: invoiceData.total,
        currency: invoiceData.currency,
      }, { maxRetries: 3 });
    }

    const emailQueued = !!invoiceData.customerEmail;
    const waQueued = !!invoiceData.customerPhone;

    await supabaseAdmin
      .from("invoice")
      .update({
        status: "PENDING",
        email_status: emailQueued ? "PENDING" : "PENDING",
        wa_status: waQueued ? "PENDING" : "PENDING",
        sent_via_email: false,
        sent_via_wa: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoiceId);

    console.log(`[InvoiceService] Invoice ${invoiceNo} queued for order ${orderId}: email=${emailQueued}, wa=${waQueued}`);

    return {
      success: true,
      invoiceNo,
      emailSent: false,
      waSent: false,
      error: undefined,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error(`[InvoiceService] Failed:`, msg);

    await supabaseAdmin
      .from("invoice")
      .update({
        status: "FAILED",
        error_log: JSON.stringify([msg]),
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoiceId);

    return { success: false, emailSent: false, waSent: false, error: msg };
  }
}

export async function sendEmailJob(payload: Record<string, unknown>): Promise<boolean> {
  const { invoiceId, invoiceNo, customerEmail, pdfUrl: _pdfUrl, orderNumber,
    customerName, currency, total, items, createdAt, paymentMethod,
    subtotal, tax, discount, storeName } = payload as Record<string, any>;

  if (!customerEmail || !invoiceNo) return false;

  const invoiceData: InvoiceData = {
    invoiceNo, orderNumber, customerName,
    customerEmail, items: items || [],
    subtotal: Number(subtotal) || 0, tax: Number(tax) || 0,
    discount: Number(discount) || 0, total: Number(total) || 0,
    currency: currency || "IDR", paymentMethod: paymentMethod || "-",
    createdAt: createdAt || new Date().toISOString(), storeName: storeName || "LEIZ STORE",
  };

  try {
    const pdfBuffer = await generateInvoicePdf(invoiceData);
    const emailHtml = buildInvoiceEmailHtml(invoiceData);
    const success = await sendInvoiceEmail(
      customerEmail,
      `Invoice #${invoiceNo} - LEIZ STORE`,
      emailHtml,
      pdfBuffer,
      `invoice-${invoiceNo}.pdf`
    );
    if (success && invoiceId) {
      await supabaseAdmin
        .from("invoice")
        .update({
          sent_via_email: true,
          email_status: "SUCCESS",
          updated_at: new Date().toISOString(),
        })
        .eq("id", invoiceId);
    }
    return success;
  } catch (err) {
    console.error(`[InvoiceService] Email job failed for ${invoiceNo}:`, err);
    return false;
  }
}

export async function sendWhatsAppJob(payload: Record<string, unknown>): Promise<boolean> {
  const { invoiceId, invoiceNo, orderNumber, total, currency, phone, orderId, pdfUrl } = payload as Record<string, any>;
  if (!phone) return false;

  const waMessage = buildWhatsAppMessage({
    invoiceNo, orderNumber, total: Number(total) || 0, currency: currency || "IDR", pdfUrl,
  });
  const success = await sendInvoiceWhatsApp(phone, waMessage, orderId || "");

  if (success && invoiceId) {
    await supabaseAdmin
      .from("invoice")
      .update({
        sent_via_wa: true,
        wa_status: "SUCCESS",
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoiceId);
  }
  return success;
}

export async function processInvoiceJob(job: { type: string; payload: Record<string, unknown> }): Promise<boolean> {
  switch (job.type) {
    case JobType.SEND_INVOICE_EMAIL:
      return sendEmailJob(job.payload);
    case JobType.SEND_INVOICE_WHATSAPP:
      return sendWhatsAppJob(job.payload);
    default:
      return false;
  }
}

export async function processPendingJobs(maxJobs = 10): Promise<number> {
  return processAll(processInvoiceJob, [JobType.SEND_INVOICE_EMAIL, JobType.SEND_INVOICE_WHATSAPP], maxJobs);
}

export async function getInvoiceByOrder(orderId: string): Promise<Invoice | null> {
  const { data } = await supabaseAdmin
    .from("invoice")
    .select("*")
    .eq("order_id", orderId)
    .maybeSingle();
  return data || null;
}

export async function listInvoices(options: {
  page?: number; limit?: number; status?: string;
}): Promise<{ items: Invoice[]; total: number; page: number; totalPages: number }> {
  const { page = 1, limit = 20, status } = options;
  const from = (page - 1) * limit;

  let query = supabaseAdmin
    .from("invoice")
    .select("*, order:order(order_number, customer_name, customer_email, total, currency)", { count: "exact" });

  if (status) query = query.eq("status", status);

  query = query.order("created_at", { ascending: false }).range(from, from + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error("[InvoiceService] List failed:", error.message);
    return { items: [], total: 0, page, totalPages: 0 };
  }

  return {
    items: (data || []) as unknown as Invoice[],
    total: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / limit),
  };
}

export async function resendInvoice(invoiceId: string): Promise<boolean> {
  const { data: invoice, error } = await supabaseAdmin
    .from("invoice")
    .select("*")
    .eq("id", invoiceId)
    .single();

  if (error || !invoice) return false;

  await supabaseAdmin
    .from("invoice")
    .update({
      status: "PENDING",
      sent_via_email: false,
      sent_via_wa: false,
      email_status: "PENDING",
      wa_status: "PENDING",
      error_log: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId);

  const orderId = invoice.order_id;
  const invoiceData = await getOrderWithItems(orderId);
  if (!invoiceData) return false;

  if (invoiceData.customerEmail) {
    await enqueue(JobType.SEND_INVOICE_EMAIL, {
      orderId,
      invoiceId,
      invoiceNo: invoice.invoice_no,
      pdfUrl: invoice.pdf_url,
      customerEmail: invoiceData.customerEmail,
      customerName: invoiceData.customerName,
      orderNumber: invoiceData.orderNumber,
      currency: invoiceData.currency,
      total: invoiceData.total,
      items: invoiceData.items,
      createdAt: invoiceData.createdAt,
      paymentMethod: invoiceData.paymentMethod,
      subtotal: invoiceData.subtotal,
      tax: invoiceData.tax,
      discount: invoiceData.discount,
      storeName: invoiceData.storeName,
    }, { maxRetries: 3 });
  }

  if (invoiceData.customerPhone) {
    await enqueue(JobType.SEND_INVOICE_WHATSAPP, {
      orderId,
      invoiceId,
      invoiceNo: invoice.invoice_no,
      phone: invoiceData.customerPhone,
      orderNumber: invoiceData.orderNumber,
      total: invoiceData.total,
      currency: invoiceData.currency,
    }, { maxRetries: 3 });
  }

  return true;
}
