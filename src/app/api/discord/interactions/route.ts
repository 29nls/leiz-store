import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { verifyKey, InteractionType, InteractionResponseType } from "discord-interactions";
import {
  adminAcceptPayment,
  adminRejectPayment,
  adminCancelOrder,
  adminForceCancelOrder,
} from "@/lib/payment/payment-service";

// Force dynamic rendering for Discord interactions
export const dynamic = "force-dynamic";

// ─── Discord interaction response helpers ──────────────────────────────────────
// Discord requires a valid HTTP response within 3 seconds.
// For button clicks we return DEFERRED_UPDATE_MESSAGE (type 6) to ACK immediately,
// then use waitUntil() to extend the Vercel function lifetime so we can PATCH
// the original message afterward.

function deferredUpdate() {
  return NextResponse.json({
    type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE,
  });
}

function ephemeralMessage(content: string, status = 200) {
  return NextResponse.json(
    {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content, flags: 64 },
    },
    { status }
  );
}

function pong() {
  return NextResponse.json({ type: InteractionResponseType.PONG });
}

// ─── Background work: process action + PATCH original Discord message ──────────

async function processPaymentAction(
  action: string,
  orderId: string,
  adminId: string,
  adminTag: string,
  patchUrl: string,
  originalEmbed: any
): Promise<void> {
  let result: { success: boolean; error?: string } = { success: false, error: "Unknown action" };

  const actionLabels: Record<string, string> = {
    accept: "✅ Pembayaran dikonfirmasi masuk",
    reject: "⚠️ Pembayaran ditandai belum masuk",
    cancel: "🚫 Order dibatalkan",
    force_cancel: "⛔ Order dibatalkan paksa",
  };

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

    console.log("[Discord] Action result:", result);
  } catch (err) {
    console.error("[Discord] Action processing error:", err);
    result = { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }

  // Build updated embed
  const embed = originalEmbed ? { ...originalEmbed } : null;
  if (embed) {
    embed.color = result.success && action === "accept" ? 0x22c55e : 0xef4444;
    embed.footer = {
      text: `${actionLabels[action] || action} oleh ${adminTag}`,
    };
  }

  const content = result.success
    ? `${actionLabels[action]} — Order ID: \`${orderId}\`\nOleh: <@${adminId}>`
    : `❌ Gagal memproses order: ${result.error}`;

  // PATCH the original message via Discord webhook
  try {
    console.log("[Discord] Patching message via", patchUrl);
    const patchRes = await fetch(patchUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content,
        embeds: embed ? [embed] : [],
        components: [], // Remove buttons after action is taken
      }),
    });

    if (!patchRes.ok) {
      const errText = await patchRes.text();
      console.error("[Discord] PATCH failed:", patchRes.status, errText);
    } else {
      console.log("[Discord] Message patched successfully");
    }
  } catch (fetchErr) {
    console.error("[Discord] PATCH network error:", fetchErr);
  }
}

// ─── POST /api/discord/interactions ──────────────────────────────────────────

export async function POST(req: NextRequest) {
  const DISCORD_PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY;
  if (!DISCORD_PUBLIC_KEY) {
    console.error("[Discord] DISCORD_PUBLIC_KEY is missing");
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  // Read raw body for signature verification
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch (e) {
    console.error("[Discord] Failed to read request body:", e);
    return ephemeralMessage("Invalid request body", 400);
  }

  // Verify ed25519 signature
  const signature = req.headers.get("x-signature-ed25519");
  const timestamp = req.headers.get("x-signature-timestamp");

  if (!signature || !timestamp) {
    console.error("[Discord] Missing signature headers");
    return ephemeralMessage("Missing signature", 401);
  }

  let isValidRequest: boolean;
  try {
    isValidRequest = await verifyKey(rawBody, signature, timestamp, DISCORD_PUBLIC_KEY);
  } catch (e) {
    console.error("[Discord] Signature verification error:", e);
    return ephemeralMessage("Invalid signature", 401);
  }

  if (!isValidRequest) {
    console.error("[Discord] Invalid signature");
    return ephemeralMessage("Invalid signature", 401);
  }

  let interaction: any;
  try {
    interaction = JSON.parse(rawBody);
  } catch (e) {
    console.error("[Discord] Failed to parse JSON:", e);
    return ephemeralMessage("Invalid JSON", 400);
  }

  const type = interaction.type;
  const customId = interaction.custom_id;

  console.log("[Discord] Received interaction:", { type, customId });

  // ── 1. PING — mandatory for Discord URL verification ─────────────────────────
  if (type === InteractionType.PING) {
    console.log("[Discord] Responding to PING");
    return pong();
  }

  // ── 2. MESSAGE_COMPONENT — button clicks ─────────────────────────────────────
  if (type === InteractionType.MESSAGE_COMPONENT) {
    if (!customId) {
      return deferredUpdate();
    }

    // Match: payment_{action}_{orderId}
    const match = customId.match(/^payment_(accept|reject|cancel|force_cancel)_(.+)$/);
    if (!match) {
      return deferredUpdate();
    }

    const action = match[1];
    const orderId = match[2];

    const interactionUser = interaction.member?.user || interaction.user;
    const adminId = interactionUser?.id || "discord_admin";
    const adminTag = interactionUser?.username || "Admin";
    const originalEmbed = interaction.message?.embeds?.[0] ?? null;

    console.log("[Discord] Processing action:", { action, orderId, adminId });

    // Build the webhook PATCH URL using the interaction token
    const patchUrl = `https://discord.com/api/v10/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`;

    // ACK immediately to Discord (within 3-second window)
    // Then extend the Vercel function lifetime with waitUntil() so the
    // background PATCH actually executes before freezing.
    waitUntil(
      processPaymentAction(action, orderId, adminId, adminTag, patchUrl, originalEmbed)
    );

    return deferredUpdate();
  }

  // ── 3. Unknown interaction type ──────────────────────────────────────────────
  console.warn("[Discord] Unknown interaction type:", type);
  return deferredUpdate();
}
