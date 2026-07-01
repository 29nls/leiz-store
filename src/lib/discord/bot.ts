/**
 * Discord Bot Integration
 * Server-side functions to send notifications via Discord webhook or bot API.
 * These are called from Next.js API routes (not a persistent bot process).
 *
 * For the interactive button handler, see scripts/discord-bot.ts
 */

import { buildSellerEmbed, buildAdminButtons, buildBuyerEmbed } from "@/lib/discord/embeds";

// ─── Config ─────────────────────────────────────────────────

function getConfig() {
  return {
    botToken: process.env.DISCORD_BOT_TOKEN || "",
    sellerChannelId: process.env.DISCORD_SELLER_CHANNEL_ID || "",
    webhookUrl: process.env.DISCORD_WEBHOOK_URL || "",
  };
}

// ─── Discord API Helper ────────────────────────────────────

async function discordApiRequest(
  endpoint: string,
  body: any | FormData,
  token: string
): Promise<Response> {
  const isFormData = body instanceof FormData;
  const headers: Record<string, string> = {
    Authorization: `Bot ${token}`,
  };
  
  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }

  return fetch(`https://discord.com/api/v10${endpoint}`, {
    method: "POST",
    headers,
    body: isFormData ? body : JSON.stringify(body),
  });
}

// ─── Send Seller Notification ───────────────────────────────

/**
 * Send a DM notification to the buyer via Discord bot API.
 * Creates a DM channel then sends an embed with order status update.
 */
export async function sendBuyerNotification(
  discordId: string,
  orderNumber: string,
  message: string
): Promise<boolean> {
  const config = getConfig();

  if (!config.botToken || !discordId) {
    console.warn("[Discord] Cannot send buyer DM: missing bot token or Discord ID");
    return false;
  }

  try {
    // Create DM channel with the user
    const dmRes = await discordApiRequest(
      `/users/@me/channels`,
      { recipient_id: discordId },
      config.botToken
    );

    if (!dmRes.ok) {
      console.error("[Discord] Failed to create DM channel:", dmRes.status, await dmRes.text());
      return false;
    }

    const dmData = await dmRes.json();
    const channelId = dmData.id;

    // Send the embed message in the DM channel
    const embed = buildBuyerEmbed(orderNumber, message);
    const msgRes = await discordApiRequest(
      `/channels/${channelId}/messages`,
      embed,
      config.botToken
    );

    if (msgRes.ok) {
      console.log("[Discord] Buyer notification sent via DM");
      return true;
    }

    console.error("[Discord] Failed to send DM message:", msgRes.status, await msgRes.text());
    return false;
  } catch (err) {
    console.error("[Discord] Buyer DM error:", err);
    return false;
  }
}

/**
 * Send a payment confirmation notification to the seller's Discord channel.
 * Includes embed with order details and interactive admin buttons.
 */
export async function sendSellerNotification(orderData: any): Promise<boolean> {
  const config = getConfig();

  // Build the message payload
  const embed = buildSellerEmbed(orderData);
  const components = buildAdminButtons(orderData.id);

  // Attach image if present
  const payload: any = { ...embed, components };
  let isMultipart = false;
  const formData = new FormData();

  if (orderData.paymentProofBase64) {
    const match = orderData.paymentProofBase64.match(/^data:(image\/.+);base64,(.+)$/);
    if (match) {
      const mime = match[1];
      const ext = mime.split("/")[1] || "png";
      const buffer = Buffer.from(match[2], "base64");
      const blob = new Blob([buffer], { type: mime });
      
      payload.embeds[0].image = { url: `attachment://proof.${ext}` };
      
      formData.append("payload_json", JSON.stringify(payload));
      formData.append("files[0]", blob, `proof.${ext}`);
      isMultipart = true;
    }
  }

  // Try bot token + channel first
  if (config.botToken && config.sellerChannelId) {
    try {
      const res = await discordApiRequest(
        `/channels/${config.sellerChannelId}/messages`,
        isMultipart ? formData : payload,
        config.botToken
      );

      if (res.ok) {
        console.log("[Discord] Seller notification sent via bot API");
        return true;
      }

      const errBody = await res.text();
      console.error("[Discord] Bot API failed:", res.status, errBody);
    } catch (err) {
      console.error("[Discord] Bot API error:", err);
    }
  }

  // Fallback: use webhook (no interactive buttons, just embed)
  if (config.webhookUrl) {
    try {
      const res = await fetch(config.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...embed,
          content: `**Konfirmasi Transfer Baru** — Order \`${orderData.order_number}\`\nAdmin: gunakan Discord bot untuk verifikasi pembayaran.`,
        }),
      });

      if (res.ok) {
        console.log("[Discord] Seller notification sent via webhook");
        return true;
      }
    } catch (err) {
      console.error("[Discord] Webhook error:", err);
    }
  }

  console.warn("[Discord] No notification method configured — skipping seller notification");
  return false;
}


