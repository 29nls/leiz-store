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
 * Discord requires a valid response within 3 seconds. Our DB update (~150ms)
 * + Discord PATCH (~150ms) = ~300ms total — well within the 3-second limit.
 * The interaction token is valid immediately (for 15 minutes), so we can
 * PATCH the webhook before returning the ACK response.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  verifyKey,
  InteractionType,
  InteractionResponseType,
} from "discord-interactions";
import {
  adminAcceptPayment,
  adminRejectPayment,
  adminCancelOrder,
  adminForceCancelOrder,
} from "@/lib/payment/payment-service";

export const dynamic = "force-dynamic";

// ─── Action labels ────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  accept: "✅ Pembayaran dikonfirmasi masuk",
  reject: "⚠️ Pembayaran ditandai belum masuk",
  cancel: "🚫 Order dibatalkan",
  force_cancel: "⛔ Order dibatalkan paksa",
};

// ─── Process action + PATCH Discord message (synchronous) ─────────────────────

async function processAndPatch(
  action: string,
  orderId: string,
  adminId: string,
  adminTag: string,
  applicationId: string,
  token: string,
  originalEmbed: any
): Promise<void> {
  // 1. Execute the DB action
  let result: { success: boolean; error?: string } = { success: false, error: "Unknown action" };

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

  // 2. Build updated embed
  const embed = originalEmbed ? JSON.parse(JSON.stringify(originalEmbed)) : null;
  if (embed) {
    embed.color = result.success && action === "accept" ? 0x22c55e : 0xef4444;
    embed.footer = { text: `${ACTION_LABELS[action] ?? action} oleh ${adminTag}` };
  }

  const content = result.success
    ? `${ACTION_LABELS[action]} — Order ID: \`${orderId}\`\nOleh: <@${adminId}>`
    : `❌ Gagal memproses order: ${result.error}`;

  // 3. PATCH the original message via Discord webhook
  const patchUrl = `https://discord.com/api/v10/webhooks/${applicationId}/${token}/messages/@original`;

  try {
    const res = await fetch(patchUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content,
        embeds: embed ? [embed] : [],
        components: [], // remove buttons
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("[Discord] PATCH failed:", res.status, body);
    } else {
      console.log("[Discord] PATCH succeeded — message updated");
    }
  } catch (err) {
    console.error("[Discord] PATCH network error:", err);
  }
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
    const customId: string | undefined = interaction.custom_id;

    // If no custom_id or unrecognized format, just ACK with deferred update
    if (!customId) {
      return NextResponse.json({
        type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE,
      });
    }

    const match = customId.match(
      /^payment_(accept|reject|cancel|force_cancel)_(.+)$/
    );

    if (!match) {
      return NextResponse.json({
        type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE,
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
    // The interaction token is valid immediately for 15 minutes.
    // We can PATCH the webhook before returning the ACK response.
    // DB (~150ms) + PATCH (~150ms) = ~300ms, well under Discord's 3s limit.
    await processAndPatch(
      action,
      orderId,
      adminId,
      adminTag,
      interaction.application_id,
      interaction.token,
      originalEmbed
    );

    // ── ACK Discord ───────────────────────────────────────────────────────────
    return NextResponse.json({
      type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE,
    });
  }

  // ── Fallback ────────────────────────────────────────────────────────────────
  console.warn("[Discord] Unhandled interaction type:", type);
  return NextResponse.json({
    type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE,
  });
}
