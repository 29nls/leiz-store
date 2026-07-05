import { supabaseAdmin } from "@/lib/supabase";

export function buildWhatsAppMessage(data: {
  invoiceNo: string;
  orderNumber: string;
  total: number;
  currency: string;
  pdfUrl?: string | null;
}): string {
  const amount =
    data.currency === "USD"
      ? `$${data.total.toFixed(2)}`
      : `Rp${data.total.toLocaleString("id-ID")}`;

  const lines = [
    `🧾 *Invoice #${data.invoiceNo}*`,
    ``,
    `Terima kasih telah berbelanja di *LEIZ STORE*!`,
    ``,
    `📋 Order: \`${data.orderNumber}\``,
    `💰 Total: ${amount}`,
    ``,
  ];

  if (data.pdfUrl) {
    lines.push(`📎 Download Invoice:`);
    lines.push(`${data.pdfUrl}`);
    lines.push(``);
  }

  lines.push(`Invoice juga sudah dikirim ke email Anda.`);
  lines.push(`Silakan cek inbox (atau folder spam).`);
  lines.push(``);
  lines.push(`Untuk bantuan, hubungi admin LEIZ STORE.`);
  lines.push(`Terima kasih 🙏`);

  return lines.join("\n");
}

export async function sendInvoiceWhatsApp(
  phoneNumber: string,
  message: string,
  orderId: string
): Promise<boolean> {
  const apiKey = process.env.WHATSAPP_API_KEY;
  const apiUrl = process.env.WHATSAPP_API_URL;

  if (!apiKey || !apiUrl) {
    console.warn("[Invoice] WhatsApp API not configured, enqueueing to DB");

    const { error } = await supabaseAdmin.from("whatsapp_queue").insert({
      id: crypto.randomUUID(),
      order_id: orderId,
      to_number: phoneNumber,
      message,
      status: "PENDING",
    });

    if (error) {
      console.error("[Invoice] Failed to enqueue WhatsApp:", error.message);
    }
    return false;
  }

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `${apiKey}`,
      },
      body: JSON.stringify({
        target: phoneNumber,
        message,
        countryCode: "62",
      }),
    });

    if (res.ok) {
      console.log(`[Invoice] WhatsApp sent to ${phoneNumber}`);
      return true;
    }

    const body = await res.text();
    console.error(`[Invoice] WhatsApp API failed (${res.status}):`, body);
    return false;
  } catch (err) {
    console.error("[Invoice] WhatsApp network error:", err);
    return false;
  }
}
