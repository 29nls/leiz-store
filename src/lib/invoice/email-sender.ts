/**
 * Invoice Email Sender (Brevo SMTP via nodemailer)
 *
 * Real SMTP delivery for the invoice PDF. This replaces the placeholder
 * path that only logged to the console; it never reports success without
 * actually handing the message to the SMTP server.
 *
 * Env contract (documented in README + .env.example):
 *   BREVO_SMTP_HOST / BREVO_SMTP_PORT / BREVO_SMTP_USER / BREVO_SMTP_PASS
 *   BREVO_FROM_EMAIL / BREVO_FROM_NAME
 */

import nodemailer from "nodemailer";
import { formatPrice } from "@/lib/currency";
import type { InvoiceData } from "./types";

export const INVOICE_EMAIL_ENV_VARS = [
  "BREVO_SMTP_HOST",
  "BREVO_SMTP_PORT",
  "BREVO_SMTP_USER",
  "BREVO_SMTP_PASS",
  "BREVO_FROM_EMAIL",
] as const;

/**
 * True only when every required SMTP variable is present. Missing config is a
 * permanent condition (retrying will not fix it), so callers treat it as a
 * "SKIPPED" outcome instead of a retryable failure.
 */
export function isEmailConfigured(): boolean {
  return INVOICE_EMAIL_ENV_VARS.every((name) => Boolean(process.env[name]));
}

export interface InvoiceEmailOptions {
  to: string;
  subject: string;
  html: string;
  pdfFilename: string;
  pdfBuffer: Buffer;
}

/**
 * Sends the invoice email with the PDF attached. Throws on transport/SMTP
 * rejection so the caller can record a retryable failure. Never swallows
 * errors and never returns a fake success.
 */
export async function sendInvoiceEmail(options: InvoiceEmailOptions): Promise<void> {
  const port = Number(process.env.BREVO_SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host: process.env.BREVO_SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.BREVO_SMTP_USER,
      pass: process.env.BREVO_SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: `"${process.env.BREVO_FROM_NAME || "LEIZ STORE"}" <${process.env.BREVO_FROM_EMAIL}>`,
    to: options.to,
    subject: options.subject,
    html: options.html,
    attachments: [
      {
        filename: options.pdfFilename,
        content: options.pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      default: return "&#39;";
    }
  });
}

function formatMoney(amount: number, currency: string): string {
  // Order currency is free-form; formatPrice supports IDR and USD.
  return formatPrice(amount, currency === "USD" ? "USD" : "IDR");
}

/**
 * Minimal, self-contained HTML body for the invoice email. All buyer-provided
 * fields are HTML-escaped to prevent injection through order data.
 */
export function buildInvoiceEmailHtml(data: InvoiceData): string {
  const storeName = escapeHtml(data.storeName || "LEIZ STORE");
  const itemRows = data.items
    .map(
      (item) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #ececec;color:#333333;">${escapeHtml(item.name)}</td>
          <td style="padding:8px 0;border-bottom:1px solid #ececec;color:#555555;text-align:center;">${item.quantity}</td>
          <td style="padding:8px 0;border-bottom:1px solid #ececec;color:#333333;text-align:right;white-space:nowrap;">${formatMoney(item.total, data.currency)}</td>
        </tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Invoice ${escapeHtml(data.invoiceNo)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
            <tr>
              <td style="background:#1c1917;padding:24px 32px;">
                <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:bold;">${storeName}</h1>
                <p style="margin:4px 0 0;color:#d6d3d1;font-size:13px;">Invoice ${escapeHtml(data.invoiceNo)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px;color:#333333;font-size:14px;line-height:1.6;">
                  Halo ${escapeHtml(data.customerName)},<br />
                  Terima kasih atas pembelian Anda. Invoice untuk pesanan
                  <strong>${escapeHtml(data.orderNumber)}</strong> terlampir dalam PDF pada email ini.
                </p>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                  <tr>
                    <td style="padding:8px 0;border-bottom:2px solid #1c1917;color:#1c1917;font-weight:bold;font-size:12px;text-transform:uppercase;">Produk</td>
                    <td style="padding:8px 0;border-bottom:2px solid #1c1917;color:#1c1917;font-weight:bold;font-size:12px;text-transform:uppercase;text-align:center;">Qty</td>
                    <td style="padding:8px 0;border-bottom:2px solid #1c1917;color:#1c1917;font-weight:bold;font-size:12px;text-transform:uppercase;text-align:right;">Total</td>
                  </tr>
                  ${itemRows}
                </table>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
                  <tr>
                    <td style="padding:4px 0;color:#555555;font-size:14px;">Subtotal</td>
                    <td style="padding:4px 0;color:#333333;font-size:14px;text-align:right;white-space:nowrap;">${formatMoney(data.subtotal, data.currency)}</td>
                  </tr>
                  ${data.tax > 0 ? `
                  <tr>
                    <td style="padding:4px 0;color:#555555;font-size:14px;">Pajak</td>
                    <td style="padding:4px 0;color:#333333;font-size:14px;text-align:right;white-space:nowrap;">${formatMoney(data.tax, data.currency)}</td>
                  </tr>` : ""}
                  ${data.discount > 0 ? `
                  <tr>
                    <td style="padding:4px 0;color:#555555;font-size:14px;">Diskon</td>
                    <td style="padding:4px 0;color:#333333;font-size:14px;text-align:right;white-space:nowrap;">-${formatMoney(data.discount, data.currency)}</td>
                  </tr>` : ""}
                  <tr>
                    <td style="padding:8px 0 0;border-top:2px solid #1c1917;color:#1c1917;font-weight:bold;font-size:15px;">Total</td>
                    <td style="padding:8px 0 0;border-top:2px solid #1c1917;color:#1c1917;font-weight:bold;font-size:15px;text-align:right;white-space:nowrap;">${formatMoney(data.total, data.currency)}</td>
                  </tr>
                </table>

                <p style="margin:24px 0 0;color:#888888;font-size:12px;line-height:1.6;">
                  Jika Anda memiliki pertanyaan tentang pesanan ini, balas email ini atau hubungi kami melalui Discord.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
