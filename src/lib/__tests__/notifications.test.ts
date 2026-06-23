import {
  sendNotification,
  notifyNewOrder,
  notifyOrderStatusChange,
  notifyLowStock,
  notifyDailyReport,
  notificationService,
} from "@/lib/notifications";
import { NotificationChannel } from "@/lib/prisma-types";

// Mock is already in jest.setup.ts for prisma and fetch

describe("Notification Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TELEGRAM_BOT_TOKEN = "test-bot-token";
    process.env.TELEGRAM_CHAT_ID = "test-chat-id";
    process.env.DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/test";
    process.env.WHATSAPP_API_KEY = "test-whatsapp-key";
    process.env.WHATSAPP_API_URL = "https://api.whatsapp.com/send";

    // Reset fetch mock
    (global.fetch as jest.Mock).mockReset();
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

    // Reset prisma mocks
    const { prisma } = jest.requireMock("@/lib/db");
    prisma.notification.create.mockResolvedValue({
      id: "notif-1",
      status: "PENDING",
    });
    prisma.notification.update.mockResolvedValue({
      id: "notif-1",
      status: "SENT",
      sentAt: new Date(),
    });
  });

  afterEach(() => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    delete process.env.DISCORD_WEBHOOK_URL;
    delete process.env.WHATSAPP_API_KEY;
    delete process.env.WHATSAPP_API_URL;
  });

  describe("sendNotification", () => {
    it("should send a Telegram notification successfully", async () => {
      const result = await sendNotification({
        channel: NotificationChannel.SMS,
        recipient: process.env.TELEGRAM_CHAT_ID!,
        subject: "Test",
        body: "Test message",
      });

      expect(result.success).toBe(true);
      expect(result.channel).toBe(NotificationChannel.SMS);
      expect(result.id).toBe("notif-1");
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("api.telegram.org"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("Test message"),
        })
      );
    });

    it("should send a Discord notification successfully", async () => {
      const result = await sendNotification({
        channel: NotificationChannel.DISCORD,
        recipient: process.env.DISCORD_WEBHOOK_URL!,
        subject: "Test",
        body: "Test message",
      });

      expect(result.success).toBe(true);
      expect(result.channel).toBe(NotificationChannel.DISCORD);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("discord.com"),
        expect.objectContaining({
          method: "POST",
        })
      );
    });

    it("should send a WhatsApp notification successfully", async () => {
      const result = await sendNotification({
        channel: NotificationChannel.WHATSAPP,
        recipient: "+6281234567890",
        subject: "Test",
        body: "Test message",
      });

      expect(result.success).toBe(true);
      expect(result.channel).toBe(NotificationChannel.WHATSAPP);
      expect(global.fetch).toHaveBeenCalledWith(
        process.env.WHATSAPP_API_URL,
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer test-whatsapp-key",
          }),
        })
      );
    });

    it("should send an email notification successfully (mock)", async () => {
      const result = await sendNotification({
        channel: NotificationChannel.EMAIL,
        recipient: "test@example.com",
        subject: "Test Email",
        body: "Test body",
      });

      expect(result.success).toBe(true);
      expect(result.channel).toBe(NotificationChannel.EMAIL);
    });

    it("should handle Telegram API failure gracefully", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false });

      const result = await sendNotification({
        channel: NotificationChannel.SMS,
        recipient: process.env.TELEGRAM_CHAT_ID!,
        subject: "Test",
        body: "Test message",
      });

      // Should have retried and then marked as failed
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it("should retry on failure", async () => {
      // Fails twice, succeeds on third attempt
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({ ok: true });

      const result = await sendNotification({
        channel: NotificationChannel.SMS,
        recipient: process.env.TELEGRAM_CHAT_ID!,
        subject: "Test",
        body: "Test message",
        retryCount: 3,
      });

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it("should handle missing Telegram credentials", async () => {
      delete process.env.TELEGRAM_BOT_TOKEN;

      const result = await sendNotification({
        channel: NotificationChannel.SMS,
        recipient: process.env.TELEGRAM_CHAT_ID!,
        subject: "Test",
        body: "Test message",
      });

      expect(result.success).toBe(false);
    });

    it("should handle missing Discord webhook URL", async () => {
      delete process.env.DISCORD_WEBHOOK_URL;

      const result = await sendNotification({
        channel: NotificationChannel.DISCORD,
        recipient: "",
        subject: "Test",
        body: "Test message",
      });

      expect(result.success).toBe(false);
    });

    it("should handle missing WhatsApp credentials", async () => {
      delete process.env.WHATSAPP_API_KEY;

      const result = await sendNotification({
        channel: NotificationChannel.WHATSAPP,
        recipient: "+6281234567890",
        subject: "Test",
        body: "Test message",
      });

      expect(result.success).toBe(false);
    });
  });

  describe("Rate Limiting", () => {
    it("should respect rate limits", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      const promises = Array.from({ length: 35 }, (_, i) =>
        sendNotification({
          channel: NotificationChannel.SMS,
          recipient: "rate-limited-chat",
          subject: `Test ${i}`,
          body: `Test message ${i}`,
        })
      );

      const results = await Promise.all(promises);
      const successCount = results.filter((r) => r.success).length;
      const rateLimitedCount = results.filter(
        (r) => r.error === "Rate limit exceeded"
      ).length;

      // Should allow up to 30 per window, then rate limit
      expect(successCount).toBe(30);
      expect(rateLimitedCount).toBe(5);
    });
  });

  describe("notifyNewOrder", () => {
    it("should send notifications via Telegram and Discord", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      const results = await notifyNewOrder({
        orderNumber: "LZ-20240101-ABC123",
        customerName: "Test Customer",
        total: 150000,
        paymentMethod: "QRIS",
        customerDiscord: "test_user#1234",
      });

      expect(results).toBeDefined();
      expect(results.length).toBe(2); // Telegram + Discord
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("should handle partial notification failures", async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true }) // Telegram succeeds
        .mockResolvedValueOnce({ ok: false }); // Discord fails

      const results = await notifyNewOrder({
        orderNumber: "LZ-20240101-ABC123",
        customerName: "Test Customer",
        total: 150000,
        paymentMethod: "QRIS",
      });

      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it("should handle all notifications failing", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false });

      const results = await notifyNewOrder({
        orderNumber: "LZ-20240101-ABC123",
        customerName: "Test Customer",
        total: 150000,
        paymentMethod: "QRIS",
      });

      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe("notifyOrderStatusChange", () => {
    it("should send WhatsApp notification when phone is provided", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      const result = await notifyOrderStatusChange(
        {
          orderNumber: "LZ-20240101-ABC123",
          customerName: "Test Customer",
        },
        "paid",
        "+6281234567890"
      );

      expect(result).not.toBeNull();
      expect(result!.success).toBe(true);
      expect(result!.channel).toBe(NotificationChannel.WHATSAPP);
    });

    it("should return null when no phone is provided", async () => {
      const result = await notifyOrderStatusChange(
        {
          orderNumber: "LZ-20240101-ABC123",
          customerName: "Test Customer",
        },
        "completed"
      );

      expect(result).toBeNull();
    });

    it("should handle unknown status gracefully", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      const result = await notifyOrderStatusChange(
        {
          orderNumber: "LZ-20240101-ABC123",
          customerName: "Test Customer",
        },
        "unknown_status",
        "+6281234567890"
      );

      expect(result).not.toBeNull();
      expect(result!.success).toBe(true);
    });
  });

  describe("notifyLowStock", () => {
    it("should send low stock notification", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      const result = await notifyLowStock({
        name: "Test Product",
        currentStock: 3,
        threshold: 5,
      });

      expect(result).not.toBeNull();
      expect(result!.success).toBe(true);
      expect(global.fetch).toHaveBeenCalled();
    });

    it("should send out-of-stock notification with urgent priority", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      const result = await notifyLowStock({
        name: "Test Product",
        currentStock: 0,
        threshold: 5,
      });

      expect(result).not.toBeNull();
      expect(result!.success).toBe(true);
    });
  });

  describe("notifyDailyReport", () => {
    it("should send daily report without throwing", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      await expect(
        notifyDailyReport({
          totalOrders: 15,
          totalRevenue: 2500000,
          newCustomers: 3,
          lowStockItems: 2,
        })
      ).resolves.toBeUndefined();
    });

    it("should handle report failure without throwing", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false });

      await expect(
        notifyDailyReport({
          totalOrders: 0,
          totalRevenue: 0,
          newCustomers: 0,
          lowStockItems: 0,
        })
      ).resolves.toBeUndefined();
    });
  });

  describe("notificationService object", () => {
    it("should export all notification functions", () => {
      expect(notificationService.sendNotification).toBeDefined();
      expect(notificationService.notifyNewOrder).toBeDefined();
      expect(notificationService.notifyOrderStatusChange).toBeDefined();
      expect(notificationService.notifyLowStock).toBeDefined();
      expect(notificationService.notifyDailyReport).toBeDefined();
    });
  });
});
