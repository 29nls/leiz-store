import { NextRequest, NextResponse } from "next/server";
import { verifyKey, InteractionType, InteractionResponseType } from "discord-interactions";
import {
  adminAcceptPayment,
  adminRejectPayment,
  adminCancelOrder,
  adminForceCancelOrder,
  getOrderForPayment,
} from "@/lib/payment/payment-service";
import { sendBuyerNotification } from "@/lib/discord/bot";


export async function POST(req: NextRequest) {
  const DISCORD_PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY;
  if (!DISCORD_PUBLIC_KEY) {
    console.error("[Discord] DISCORD_PUBLIC_KEY is missing");
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  // Discord HTTP Interaction headers
  const signature = req.headers.get("x-signature-ed25519");
  const timestamp = req.headers.get("x-signature-timestamp");

  if (!signature || !timestamp) {
    return NextResponse.json({ error: "Missing signature" }, { status: 401 });
  }

  // Read raw body for signature verification
  const rawBody = await req.text();

  const isValidRequest = await verifyKey(
    rawBody,
    signature,
    timestamp,
    DISCORD_PUBLIC_KEY
  );

  if (!isValidRequest) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const interaction = JSON.parse(rawBody);
  const { type, custom_id, member, user, message } = interaction;
  
  // Provide a fallback admin ID from interaction
  const interactionUser = member?.user || user;
  const adminId = interactionUser?.id || "discord_admin";
  const adminTag = interactionUser?.username || "Admin";

  // 1. Handle PING (Mandatory for Discord setup)
  if (type === InteractionType.PING) {
    return NextResponse.json({ type: InteractionResponseType.PONG });
  }

  // 2. Handle Button Clicks
  if (type === InteractionType.MESSAGE_COMPONENT) {
    if (!custom_id) {
      return NextResponse.json({ error: "No custom_id" }, { status: 400 });
    }

    // Format: payment_{action}_{orderId}
    const match = custom_id.match(/^payment_(accept|reject|cancel|force_cancel)_(.+)$/);
    
    if (!match) {
      return NextResponse.json({ type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE });
    }

    const [, action, orderId] = match;

    let result: { success: boolean; error?: string };

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
        default:
          result = { success: false, error: "Unknown action" };
      }

      if (!result.success) {
        return NextResponse.json({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `❌ Gagal memproses order: ${result.error}`,
            flags: 64, // Ephemeral
          }
        });
      }

      // Notify Buyer in the background
      try {
        const orderData = await getOrderForPayment(orderId);
        if (orderData) {
          const msgs: Record<string, string> = {
            accept: "✅ Pembayaran Anda telah diverifikasi! Pesanan sedang diproses.",
            reject: "⚠️ Pembayaran belum terdeteksi. Silakan cek kembali atau hubungi admin.",
            cancel: "❌ Pesanan Anda telah dibatalkan.",
            force_cancel: "❌ Pesanan Anda telah dibatalkan oleh admin.",
          };
          await sendBuyerNotification(
            orderData.buyer_discord_id || orderData.customer_discord,
            orderData.order_number,
            msgs[action] || "Status pesanan diperbarui."
          );
        }
      } catch (err) {
        console.error("[DiscordInteraction] Buyer notification failed:", err);
      }

      const actionLabels: Record<string, string> = {
        accept: "✅ Pembayaran dikonfirmasi masuk",
        reject: "⚠️ Pembayaran ditandai belum masuk",
        cancel: "🚫 Order dibatalkan",
        force_cancel: "⛔ Order dibatalkan paksa",
      };

      const embed = message.embeds[0];
      if (embed) {
        embed.color = action === "accept" ? 0x22c55e : 0xef4444;
        embed.footer = {
          text: `${actionLabels[action]} oleh ${adminTag}`,
        };
      }

      // Return UPDATE_MESSAGE
      return NextResponse.json({
        type: InteractionResponseType.UPDATE_MESSAGE,
        data: {
          content: `${actionLabels[action]} — Order ID: \`${orderId}\`\nOleh: <@${adminId}>`,
          embeds: embed ? [embed] : [],
          components: [],
        },
      });

    } catch (err) {
      console.error("[DiscordInteraction] Processing error:", err);
      return NextResponse.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `❌ Terjadi kesalahan internal saat memproses aksi.`,
          flags: 64, // Ephemeral
        }
      });
    }
  }

  return NextResponse.json({ error: "Unknown interaction type" }, { status: 400 });
}
