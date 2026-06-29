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
  body: any,
  token: string
): Promise<Response> {
  return fetch(`https://discord.com/api/v10${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bot ${token}`,
    },
    body: JSON.stringify(body),
  });
}

// ─── Send Seller Notification ───────────────────────────────

/**
 * Send a payment confirmation notification to the seller's Discord channel.
 * Includes embed with order details and interactive admin buttons.
 */
export async function sendSellerNotification(orderData: any): Promise<boolean> {
  const config = getConfig();

  // Build the message payload
  const embed = buildSellerEmbed(orderData);
  const components = buildAdminButtons(orderData.id);

  // Try bot token + channel first
  if (config.botToken && config.sellerChannelId) {
    try {
      const res = await discordApiRequest(
        `/channels/${config.sellerChannelId}/messages`,
        { ...embed, components },
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

// ─── Send Buyer Notification (DM) ───────────────────────────

/**
 * Send a DM to the buyer based on their Discord ID.
 * Requires the bot token to be configured.
 */
export async function sendBuyerNotification(
  buyerDiscordId: string | null | undefined,
  orderNumber: string,
  message: string
): Promise<boolean> {
  if (!buyerDiscordId) {
    console.warn("[Discord] No buyer Discord ID — skipping buyer notification");
    return false;
  }

  const config = getConfig();
  if (!config.botToken) {
    console.warn("[Discord] No bot token — skipping buyer DM");
    return false;
  }

  try {
    // Step 1: Create DM channel
    const dmRes = await discordApiRequest(
      "/users/@me/channels",
      { recipient_id: buyerDiscordId },
      config.botToken
    );

    if (!dmRes.ok) {
      const errBody = await dmRes.text();
      console.error("[Discord] Failed to create DM channel:", dmRes.status, errBody);
      return false;
    }

    const dmChannel = await dmRes.json();

    // Step 2: Send message to DM channel
    const embed = buildBuyerEmbed(orderNumber, message);
    const msgRes = await discordApiRequest(
      `/channels/${dmChannel.id}/messages`,
      embed,
      config.botToken
    );

    if (msgRes.ok) {
      console.log(`[Discord] Buyer DM sent to ${buyerDiscordId}`);
      return true;
    }

    const errBody = await msgRes.text();
    console.error("[Discord] Failed to send DM:", msgRes.status, errBody);
    return false;
  } catch (err) {
    console.error("[Discord] Buyer DM error:", err);
    return false;
  }
}
