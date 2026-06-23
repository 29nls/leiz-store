/**
 * Enhanced Notification Service
 * Multi-channel notifications with retry logic and rate limiting
 */

import { prisma } from "@/lib/db";
import { NotificationStatus, NotificationChannel } from "@/lib/prisma-types";
type InputJsonValue = any;

interface NotificationPayload {
  channel: NotificationChannel;
  recipient: string;
  subject: string;
  body: string;
  metadata?: InputJsonValue;
  storeId?: string;
  priority?: "low" | "normal" | "high" | "urgent";
  retryCount?: number;
}

interface NotificationResult {
  id: string;
  success: boolean;
  channel: string;
  error?: string;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const RATE_LIMIT_WINDOW_MS = 60000;
const RATE_LIMIT_MAX = 30;

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Send notification with retry logic
 */
export async function sendNotification(
  payload: NotificationPayload
): Promise<NotificationResult> {
  const rateLimitKey = `${payload.channel}:${payload.recipient}`;

  if (!checkRateLimit(rateLimitKey)) {
    return {
      id: "",
      success: false,
      channel: payload.channel,
      error: "Rate limit exceeded",
    };
  }

  // Store notification in database
  const notification = await prisma.notification.create({
    data: {
      channel: payload.channel as NotificationChannel,
      recipient: payload.recipient,
      subject: payload.subject,
      body: payload.body,
      status: NotificationStatus.PENDING,
      metadata: payload.metadata,
      storeId: payload.storeId,
    },
  });

  let lastError: string | null = null;
  const retries = payload.retryCount || MAX_RETRIES;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      let success = false;

      switch (payload.channel) {
        case NotificationChannel.SMS:
          success = await sendTelegramMessage(payload.recipient, payload.body);
          break;
        case NotificationChannel.DISCORD:
          success = await sendDiscordMessage(payload.recipient, payload.body);
          break;
        case NotificationChannel.WHATSAPP:
          success = await sendWhatsAppMessage(payload.recipient, payload.body);
          break;
        case NotificationChannel.EMAIL:
          success = await sendEmailMessage(
            payload.recipient,
            payload.subject,
            payload.body
          );
          break;
      }

      if (success) {
        await prisma.notification.update({
          where: { id: notification.id },
          data: { status: NotificationStatus.SENT, sentAt: new Date() },
        });

        return {
          id: String(notification.id),
          success: true,
          channel: payload.channel,
        };
      }

      lastError = `Attempt ${attempt + 1} failed`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unknown error";
    }

    if (attempt < retries - 1) {
      await delay(RETRY_DELAY_MS * (attempt + 1));
    }
  }

  // Mark as failed after all retries
  await prisma.notification.update({
    where: { id: notification.id },
    data: { status: NotificationStatus.FAILED },
  });

  return {
    id: String(notification.id),
    success: false,
    channel: payload.channel,
    error: lastError || "All retries failed",
  };
}

/**
 * Send Telegram message
 */
async function sendTelegramMessage(
  chatId: string,
  message: string
): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.warn("Telegram bot token not configured");
    return false;
  }

  const targetChatId = chatId || process.env.TELEGRAM_CHAT_ID;
  if (!targetChatId) {
    console.warn("Telegram chat ID not configured");
    return false;
  }

  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: targetChatId,
        text: message,
        parse_mode: "HTML",
      }),
    }
  );

  return response.ok;
}

/**
 * Send Discord webhook message
 */
async function sendDiscordMessage(
  webhookUrl: string,
  message: string
): Promise<boolean> {
  const url = webhookUrl || process.env.DISCORD_WEBHOOK_URL;
  if (!url) {
    console.warn("Discord webhook URL not configured");
    return false;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: message,
      username: process.env.STORE_NAME || "LEIZ STORE",
    }),
  });

  return response.ok;
}

/**
 * Send WhatsApp message via API
 */
async function sendWhatsAppMessage(
  phoneNumber: string,
  message: string
): Promise<boolean> {
  const apiKey = process.env.WHATSAPP_API_KEY;
  const apiUrl = process.env.WHATSAPP_API_URL;

  if (!apiKey || !apiUrl) {
    console.warn("WhatsApp API not configured");
    return false;
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      phone: phoneNumber,
      message,
    }),
  });

  return response.ok;
}

/**
 * Send email message (placeholder - integrate with your email provider)
 */
async function sendEmailMessage(
  to: string,
  subject: string,
  body: string
): Promise<boolean> {
  // Placeholder for email integration (SendGrid, Resend, etc.)
  console.log(`Email to ${to}: ${subject}`);
  console.log(`Body: ${body}`);
  return true;
}

// ─── High-Level Notification Templates ────────────────────────

export async function notifyNewOrder(order: {
  orderNumber: string;
  customerName: string;
  total: number;
  paymentMethod: string;
  customerDiscord?: string;
}): Promise<NotificationResult[]> {
  const message = [
    `🛒 *New Order Received!*`,
    ``,
    `📋 Order: \`${order.orderNumber}\``,
    `👤 Customer: ${order.customerName}`,
    `💰 Total: Rp${order.total.toLocaleString("id-ID")}`,
    `💳 Payment: ${order.paymentMethod}`,
    order.customerDiscord ? `🎮 Discord: ${order.customerDiscord}` : null,
    ``,
    `⏰ ${new Date().toLocaleString("id-ID")}`,
  ]
    .filter(Boolean)
    .join("\n");

  const results = await Promise.allSettled([
    sendNotification({
      channel: NotificationChannel.SMS,
      recipient: process.env.TELEGRAM_CHAT_ID || "",
      subject: "New Order",
      body: message,
      priority: "high",
    }),
    sendNotification({
      channel: NotificationChannel.DISCORD,
      recipient: process.env.DISCORD_WEBHOOK_URL || "",
      subject: "New Order",
      body: message,
      priority: "high",
    }),
  ]);

  return results
    .filter((r) => r.status === "fulfilled")
    .map((r) => r.value);
}

export async function notifyOrderStatusChange(
  order: { orderNumber: string; customerName: string },
  newStatus: string,
  customerPhone?: string
): Promise<NotificationResult | null> {
  const statusEmoji: Record<string, string> = {
    PAID: "✅",
    PROCESSING: "⚙️",
    COMPLETED: "🎉",
    CANCELLED: "❌",
  };

  const message = [
    `${statusEmoji[newStatus] || "📋"} *Order ${newStatus.toUpperCase()}*`,
    ``,
    `📋 Order: \`${order.orderNumber}\``,
    `👤 Customer: ${order.customerName}`,
    ``,
    `Status updated to: *${newStatus}*`,
  ].join("\n");

  if (customerPhone) {
    return sendNotification({
      channel: NotificationChannel.WHATSAPP,
      recipient: customerPhone,
      subject: `Order ${newStatus}`,
      body: message,
      priority: "normal",
    });
  }

  return null;
}

export async function notifyLowStock(product: {
  name: string;
  currentStock: number;
  threshold: number;
}): Promise<NotificationResult | null> {
  const isOut = product.currentStock === 0;
  const message = [
    `${isOut ? "❌" : "⚠️"} *Stock Alert*`,
    ``,
    `📦 Product: ${product.name}`,
    `📊 Current: ${product.currentStock}`,
    `🔔 Threshold: ${product.threshold}`,
    isOut ? `\n*OUT OF STOCK*` : `\n*LOW STOCK WARNING*`,
  ].join("\n");

  return sendNotification({
    channel: NotificationChannel.SMS,
    recipient: process.env.TELEGRAM_CHAT_ID || "",
    subject: isOut ? "Out of Stock" : "Low Stock",
    body: message,
    priority: isOut ? "urgent" : "high",
  });
}

export async function notifyDailyReport(stats: {
  totalOrders: number;
  totalRevenue: number;
  newCustomers: number;
  lowStockItems: number;
}): Promise<void> {
  const message = [
    `📊 *Daily Report - ${new Date().toLocaleDateString("id-ID")}*`,
    ``,
    `📦 Orders: ${stats.totalOrders}`,
    `💰 Revenue: Rp${stats.totalRevenue.toLocaleString("id-ID")}`,
    `👥 New Customers: ${stats.newCustomers}`,
    `⚠️ Low Stock Items: ${stats.lowStockItems}`,
  ].join("\n");

  await sendNotification({
    channel: NotificationChannel.SMS,
    recipient: process.env.TELEGRAM_CHAT_ID || "",
    subject: "Daily Report",
    body: message,
    priority: "low",
  });
}

export const notificationService = {
  sendNotification,
  notifyNewOrder,
  notifyOrderStatusChange,
  notifyLowStock,
  notifyDailyReport,
};