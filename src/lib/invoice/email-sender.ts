import nodemailer from "nodemailer";
import type { InvoiceData } from "./types";

function getTransporter() {
  const host = process.env.BREVO_SMTP_HOST || "smtp-relay.brevo.com";
  const port = parseInt(process.env.BREVO_SMTP_PORT || "587", 10);
  const user = process.env.BREVO_SMTP_USER || "";
  const pass = process.env.BREVO_SMTP_PASS || "";

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

function formatCurrency(amount: number, currency: string): string {
  if (currency === "USD") return `$${amount.toFixed(2)}`;
  return `Rp${amount.toLocaleString("id-ID")}`;
}

export function buildInvoiceEmailHtml(data: InvoiceData): string {
  const itemsHtml = data.items
    .map(
      (item) => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #eee;">${item.name}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${formatCurrency(item.price, data.currency)}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${formatCurrency(item.total, data.currency)}</td>
        </tr>`
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#f9f9f9;padding:20px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
    <div style="background:#7c3aed;padding:24px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:20px;">INVOICE</h1>
    </div>
    <div style="padding:24px;">
      <p style="color:#666;font-size:13px;">Invoice #: <strong>${data.invoiceNo}</strong></p>
      <p style="color:#666;font-size:13px;">Order: <strong>${data.orderNumber}</strong></p>
      <p style="color:#666;font-size:13px;">Date: <strong>${new Date(data.createdAt).toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" })}</strong></p>
      <hr style="border:none;border-top:1px solid #eee;margin:16px 0;">
      <h3 style="color:#333;font-size:14px;">Bill To:</h3>
      <p style="color:#555;font-size:13px;margin:4px 0;">${data.customerName}</p>
      ${data.customerEmail ? `<p style="color:#555;font-size:13px;margin:4px 0;">${data.customerEmail}</p>` : ""}
      <hr style="border:none;border-top:1px solid #eee;margin:16px 0;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#f3f3f3;">
            <th style="padding:8px;text-align:left;">Item</th>
            <th style="padding:8px;text-align:center;">Qty</th>
            <th style="padding:8px;text-align:right;">Price</th>
            <th style="padding:8px;text-align:right;">Total</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      <hr style="border:none;border-top:1px solid #eee;margin:16px 0;">
      <div style="text-align:right;font-size:14px;">
        ${data.discount > 0 ? `<p style="color:#666;margin:4px 0;">Discount: -${formatCurrency(data.discount, data.currency)}</p>` : ""}
        ${data.tax > 0 ? `<p style="color:#666;margin:4px 0;">Tax: ${formatCurrency(data.tax, data.currency)}</p>` : ""}
        <p style="color:#333;margin:4px 0;font-weight:bold;font-size:16px;">Total: ${formatCurrency(data.total, data.currency)}</p>
      </div>
      <hr style="border:none;border-top:1px solid #eee;margin:16px 0;">
      <p style="color:#555;font-size:13px;">Payment: ${data.paymentMethod || "-"}</p>
      <p style="color:#999;font-size:11px;text-align:center;margin-top:24px;">Thank you for shopping at LEIZ STORE!</p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendInvoiceEmail(
  to: string,
  subject: string,
  html: string,
  pdfBuffer: Buffer,
  pdfFilename: string
): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn("[Invoice] Brevo SMTP not configured, skipping email");
    return false;
  }

  try {
    await transporter.sendMail({
      from: `"LEIZ STORE" <${process.env.BREVO_SMTP_USER}>`,
      to,
      subject,
      html,
      attachments: [
        {
          filename: pdfFilename,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });
    console.log(`[Invoice] Email sent to ${to}`);
    return true;
  } catch (err) {
    console.error("[Invoice] Email send failed:", err);
    return false;
  }
}
