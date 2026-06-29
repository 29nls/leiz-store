import { NextRequest, NextResponse, after } from "next/server";
import { verifyKey, InteractionType, InteractionResponseType } from "discord-interactions";
import {
  adminAcceptPayment,
  adminRejectPayment,
  adminCancelOrder,
  adminForceCancelOrder,
  getOrderForPayment,
} from "@/lib/payment/payment-service";


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

    // Use after() to process the DB action and patch Discord asynchronously
    after(async () => {
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

        // Patch the original message
        await fetch(
          `https://discord.com/api/v10/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              content: result.success 
                ? `${actionLabels[action]} — Order ID: \`${orderId}\`\nOleh: <@${adminId}>`
                : `❌ Gagal memproses order: ${result.error}`,
              embeds: embed ? [embed] : [],
              components: [],
            }),
          }
        );
      } catch (err) {
        console.error("[DiscordInteraction] Processing error:", err);
      }
    });

    // Immediately acknowledge the button click to prevent "Interaction failed"
    return NextResponse.json({
      type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE,
    });
  }

  return NextResponse.json({ error: "Unknown interaction type" }, { status: 400 });
}
