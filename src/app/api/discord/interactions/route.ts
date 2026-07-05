/**
 * Discord Interactions Endpoint
 * POST /api/discord/interactions
 *
 * Handles Discord HTTP interactions (PING + button clicks).
 *
 * IMPORTANT: All work is done synchronously in this handler.
 * No background processing (after(), waitUntil(), etc.) is used because
 * Vercel serverless freezes the function immediately after the HTTP response
 * is sent, making background work unreliable.
 *
 * Uses UPDATE_MESSAGE (type 7) for button clicks — the response itself
 * directly updates the Discord message. No separate PATCH call needed.
 * DB update (~150ms) + ephemeral followup (~150ms) = ~300ms total,
 * well within Discord's 3-second limit.
 * The interaction token is valid immediately (for 15 minutes), so we can
 * send the ephemeral followup before returning the response.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  verifyKey,
  InteractionType,
  InteractionResponseType,
} from "discord-interactions";
import { sendBuyerNotification } from "@/lib/discord/bot";
import {
  adminAcceptPayment,
  adminRejectPayment,
  adminCancelOrder,
  adminForceCancelOrder,
} from "@/lib/payment/payment-service";
import { generateAndSendInvoice } from "@/lib/invoice";

export const dynamic = "force-dynamic";

// ─── Action labels ────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  accept: "✅ Pembayaran dikonfirmasi masuk",
  reject: "⚠️ Pembayaran ditandai belum masuk",
  cancel: "🚫 Order dibatalkan",
  force_cancel: "⛔ Order dibatalkan paksa",
};

function isSafeDiscordPathSegment(value: string, pattern: RegExp): boolean {
  return typeof value === "string" && pattern.test(value);
}

// ─── Send ephemeral followup (visible only to the clicking user) ──────────────

async function sendEphemeralFollowup(
  applicationId: string,
  token: string,
  content: string
): Promise<void> {
  if (
    !isSafeDiscordPathSegment(applicationId, /^\d+$/) ||
    !isSafeDiscordPathSegment(token, /^[A-Za-z0-9._-]+$/)
  ) {
    console.error("[Discord] Invalid webhook identifiers for followup");
    return;
  }

  try {
    const url = new URL(
      `/api/v10/webhooks/${encodeURIComponent(applicationId)}/${encodeURIComponent(token)}`,
      "https://discord.com"
    ).toString();

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content,
        flags: 64, // EPHEMERAL — only the clicking user sees this
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("[Discord] Ephemeral followup failed:", res.status, body);
    }
  } catch (err) {
    console.error("[Discord] Ephemeral followup network error:", err);
  }
}

// ─── Process action + build response data (synchronous) ───────────────────────
// Uses UPDATE_MESSAGE (type 7) so the response itself directly updates the
// Discord message — no separate PATCH call needed. The interaction token is
// valid immediately, so ephemeral followups can be sent before the response.

interface MessageUpdateData {
  content: string;
  embeds: any[];
  components: any[];
}

// ─── Buyer DM messages per action ────────────────────────────────────────

const BUYER_MESSAGES: Record<string, string> = {
  accept: "**Pembayaran Anda telah dikonfirmasi!** 🎉\n\nPesanan sedang diproses dan akan segera dikirim. Kami akan memberitahu Anda ketika pesanan sudah selesai.\n\nTerima kasih telah berbelanja di **LEIZ STORE** 🙏",
  reject: "**Pembayaran tidak dapat diverifikasi.** ⚠️\n\nEmail atau nomor WhatsApp pesanan mungkin bermasalah. Silakan periksa kembali atau hubungi admin untuk informasi lebih lanjut.\n\nKamu bisa melakukan upload ulang bukti transfer melalui website.",
  cancel: "**Pesanan dibatalkan.** 🚫\n\nPesanan kamu telah dibatalkan. Jika ada pertanyaan, silakan hubungi admin LEIZ STORE.\n\nTerima kasih 🙏",
  force_cancel: "**Pesanan dibatalkan paksa.** ⛔\n\nPesanan kamu telah dibatalkan oleh sistem. Silakan hubungi admin LEIZ STORE untuk informasi lebih lanjut.\n\nTerima kasih 🙏",
};

async function processAction(
  action: string,
  orderId: string,
  adminId: string,
  adminTag: string,
  applicationId: string,
  token: string,
  originalEmbed: any
): Promise<MessageUpdateData> {
  // 1. Execute the DB action (must complete before response)
  let result: { success: boolean; error?: string; order?: any } = { success: false, error: "Unknown action" };

  try {
    switch (action) {
      case "accept":
        result = await adminAcceptPayment(orderId, adminId);
        break;
      case "reject":
        result = await adminRejectPayment(orderId, adminId);
        break;
      case "cancel":
        result = await adminCancelOrder(orderId, adminId);
        break;
      case "force_cancel":
        result = await adminForceCancelOrder(orderId, adminId);
        break;
    }
    console.log("[Discord] DB action result:", { action, orderId, success: result.success });
  } catch (err) {
    console.error("[Discord] DB action error:", err);
    result = {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }

  const actionLabel = ACTION_LABELS[action] ?? action;

  // 2. Build updated embed for the response (synchronous)
  const embed = originalEmbed ? JSON.parse(JSON.stringify(originalEmbed)) : null;
  if (embed) {
    embed.color = result.success && action === "accept" ? 0x22c55e : 0xef4444;
    embed.footer = { text: `${actionLabel} oleh ${adminTag}` };
  }

  const content = result.success
    ? `${actionLabel} — Order ID: \`${orderId}\`\nOleh: <@${adminId}>`
    : `❌ Gagal memproses order: ${result.error}`;

  const messageData: MessageUpdateData = {
    content,
    embeds: embed ? [embed] : [],
    components: [], // remove buttons
  };

  // 3. Fire-and-forget: Send ephemeral followup to admin (non-blocking)
  // Do NOT await - this runs after response is returned to Discord
  // Interaction token is valid for 15 minutes from Discord's POST
  const followupContent = result.success
    ? `${actionLabel}\nOrder ID: \`${orderId}\`\nStatus: ✅ Berhasil`
    : `❌ **Gagal:** ${result.error ?? "Terjadi kesalahan"}\nAction: ${actionLabel}\nOrder ID: \`${orderId}\``;
  sendEphemeralFollowup(applicationId, token, followupContent).catch((err) =>
    console.error("[Discord] Ephemeral followup failed:", err)
  );

  // 4. Fire-and-forget: Send DM notification to buyer (non-blocking)
  if (result.success && result.order) {
    const order = result.order;
    const buyerDiscordId = order.buyer_discord_id || order.customer_discord || order.buyerDiscordId || null;
    const orderNumber = order.order_number || order.orderNumber || orderId;
    const buyerMessage = BUYER_MESSAGES[action];

    if (buyerDiscordId && buyerMessage) {
      sendBuyerNotification(buyerDiscordId, orderNumber, buyerMessage)
        .then((sent) => {
          if (sent) console.log(`[Discord] Buyer DM sent for order ${orderNumber}`);
        })
        .catch((err) => console.error("[Discord] Buyer DM error:", err));
    }

    // 5. Fire-and-forget: Generate & send invoice on payment accept (non-blocking)
    if (action === "accept") {
      generateAndSendInvoice(orderId)
        .then((invResult) => {
          if (invResult.success) {
            console.log(`[Discord] Invoice ${invResult.invoiceNo} sent for order ${orderId}`);
          } else {
            console.warn(`[Discord] Invoice generation partially failed for order ${orderId}:`, invResult.error);
          }
        })
        .catch((err) => console.error("[Discord] Invoice generation error:", err));
    }
  }

  return messageData;
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Read body ───────────────────────────────────────────────────────────────
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return new NextResponse("Bad request", { status: 400 });
  }

  // ── Verify ed25519 signature ────────────────────────────────────────────────
  const signature = req.headers.get("x-signature-ed25519");
  const timestamp = req.headers.get("x-signature-timestamp");

  if (!signature || !timestamp) {
    return new NextResponse("Missing signature", { status: 401 });
  }

  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  if (!publicKey) {
    console.error("[Discord] DISCORD_PUBLIC_KEY not set");
    return new NextResponse("Server misconfiguration", { status: 500 });
  }

  let isValid: boolean;
  try {
    isValid = await verifyKey(rawBody, signature, timestamp, publicKey);
  } catch {
    isValid = false;
  }

  if (!isValid) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  // ── Parse interaction ───────────────────────────────────────────────────────
  let interaction: any;
  try {
    interaction = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  const type: number = interaction.type;

  // ── PING ────────────────────────────────────────────────────────────────────
  if (type === InteractionType.PING) {
    return NextResponse.json({ type: InteractionResponseType.PONG });
  }

  // ── MESSAGE_COMPONENT (button clicks) ───────────────────────────────────────
  if (type === InteractionType.MESSAGE_COMPONENT) {
    const customId: string | undefined = interaction.data?.custom_id;
    const applicationId: string = interaction.application_id;
    const token: string = interaction.token;

    // If no custom_id — respond with ephemeral error message
    if (!customId) {
      return NextResponse.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: "❌ Tombol tidak dikenali (custom_id kosong). Silakan hubungi developer.",
          flags: 64, // EPHEMERAL — only the clicking user sees this
        },
      });
    }

    const match = customId.match(
      /^payment_(accept|reject|cancel|force_cancel)_(.+)$/
    );

    // If unrecognized format — respond with ephemeral error message
    if (!match) {
      return NextResponse.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `❌ Tombol tidak dikenali: \`${customId}\`\nSilakan hubungi developer.`,
          flags: 64, // EPHEMERAL — only the clicking user sees this
        },
      });
    }

    const action = match[1];
    const orderId = match[2];
    const interactionUser = interaction.member?.user ?? interaction.user;
    const adminId: string = interactionUser?.id ?? "discord_admin";
    const adminTag: string = interactionUser?.username ?? "Admin";
    const originalEmbed = interaction.message?.embeds?.[0] ?? null;

    console.log(
      `[Discord] Button click: action=${action} orderId=${orderId} admin=${adminId}`
    );

    // ── Do ALL work synchronously before returning ────────────────────────────
    // Uses UPDATE_MESSAGE (type 7) so the response itself directly updates the
    // Discord message, eliminating the need for a separate PATCH call.
    // DB (~150ms) + ephemeral (~150ms) = ~300ms total, well under Discord's 3s limit.
    const messageData = await processAction(
      action,
      orderId,
      adminId,
      adminTag,
      applicationId,
      token,
      originalEmbed
    );

    // ── ACK + update message in one response ─────────────────────────────────
    return NextResponse.json({
      type: InteractionResponseType.UPDATE_MESSAGE,
      data: messageData,
    });
  }

  // ── Fallback ────────────────────────────────────────────────────────────────
  console.warn("[Discord] Unhandled interaction type:", type);
  return NextResponse.json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `❌ Interaksi tidak dikenal (type: ${type}). Silakan hubungi developer.`,
      flags: 64, // EPHEMERAL
    },
  });
}
