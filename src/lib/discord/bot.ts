/**
 * Discord Bot Integration
 * Server-side functions to send notifications via Discord webhook or bot API.
 * These are called from Next.js API routes (not a persistent bot process).
 */

import { buildSellerEmbed, buildAdminButtons, buildBuyerEmbed } from "@/lib/discord/embeds";

function getConfig() {
  return {
    botToken: process.env.DISCORD_BOT_TOKEN || "",
    sellerChannelId: process.env.DISCORD_SELLER_CHANNEL_ID || "",
    webhookUrl: process.env.DISCORD_WEBHOOK_URL || "",
  };
}

async function discordApiRequest(endpoint: string, body: any | FormData, token: string): Promise<Response> {
  const isFormData = body instanceof FormData;
  const headers: Record<string, string> = { Authorization: `Bot ${token}` };
  if (!isFormData) headers["Content-Type"] = "application/json";

  const response = await fetch(`https://discord.com/api/v10${endpoint}`, {
    method: "POST",
    headers,
    body: isFormData ? body : JSON.stringify(body),
  });
  return response;
}

export async function sendBuyerNotification(
  discordId: string,
  orderNumber: string,
  message: string
): Promise<boolean> {
  const config = getConfig();
  if (!config.botToken || !discordId) return false;
  if (!/^\d{17,19}$/.test(discordId)) return false;

  try {
    const dmRes = await discordApiRequest(
      "/users/@me/channels",
      { recipient_id: discordId },
      config.botToken
    );
    if (!dmRes.ok) return false;

    const dmData = await dmRes.json();
    const msgRes = await discordApiRequest(
      `/channels/${dmData.id}/messages`,
      buildBuyerEmbed(orderNumber, message),
      config.botToken
    );
    return msgRes.ok;
  } catch (err) {
    console.error("[Discord] Buyer DM error:", err);
    return false;
  }
}

export async function sendSellerNotification(orderData: any): Promise<boolean> {
  const config = getConfig();
  const embed = buildSellerEmbed(orderData);
  const components = buildAdminButtons(orderData.id);
  const payload: any = { ...embed, components };

  if (orderData.paymentProofUrl && payload.embeds?.[0]) {
    payload.embeds[0].image = { url: orderData.paymentProofUrl };
  }

  if (config.botToken && config.sellerChannelId) {
    try {
      const res = await discordApiRequest(
        `/channels/${config.sellerChannelId}/messages`,
        payload,
        config.botToken
      );
      if (res.ok) return true;
      console.error("[Discord] Bot API failed:", res.status, await res.text());
    } catch (err) {
      console.error("[Discord] Bot API error:", err);
    }
  }

  if (config.webhookUrl) {
    try {
      const res = await fetch(config.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...embed, content: `🛒 **KONFIRMASI TRANSFER BARU**\nOrder: \`${orderData.order_number}\`` }),
      });
      if (res.ok) return true;
    } catch (err) {
      console.warn("[Discord] Webhook error:", err);
    }
  }

  return false;
}
