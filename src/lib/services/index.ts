/**
 * Service Layer
 * Business logic and orchestration of repository calls
 */

import {
  productRepository,
  categoryRepository,
  orderRepository,
  userRepository,
  activityLogRepository,
  inventoryLogRepository,
  settingRepository,
  analyticsRepository,
  stockAlertRepository,
  notificationRepository,
  customerSegmentRepository,
  recommendationRepository,
  forecastRepository,
} from "@/lib/repositories";
import { convertCurrency, type Currency } from "@/lib/currency";
import { prisma } from "@/lib/db";
import { Prisma } from "@generated/prisma/client";
import {
  Role,
  OrderStatus,
  PaymentMethod,
  NotificationChannel,
  StockAlertType,
} from "@generated/prisma/client";

// Helper function to replace Prisma.Decimal
function toDecimal(value: number): number {
  return value;
}
import {
  NotFoundError,
  ValidationError,
} from "@/lib/errors";

// ─── Product Service ────────────────────────────────────────

export const productService = {
  async list(options: {
    page?: number;
    limit?: number;
    category?: string;
    search?: string;
    sort?: string;
    minPrice?: number;
    maxPrice?: number;
    badge?: string;
    featured?: boolean;
    currency?: Currency;
  }) {
    const { page = 1, limit = 20, category, search, sort, minPrice, maxPrice, badge, featured, currency = "IDR" } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = { isActive: true };

    if (featured === true) {
      where.isFeatured = true;
    }

    if (category) {
      // JSON-DB doesn't support nested relation filters in where clauses.
      // Look up the category by slug first, then filter by categoryId.
      const cat = await prisma.category.findUnique({ where: { slug: category } });
      if (cat) {
        (where as any).categoryId = cat.id;
      } else {
        // Unknown category slug — return nothing
        (where as any).categoryId = "__no_match__";
      }
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }
    if (minPrice !== undefined || maxPrice !== undefined) {
      const priceFilter: Record<string, number> = {};
      if (minPrice !== undefined) priceFilter.gte = minPrice;
      if (maxPrice !== undefined) priceFilter.lte = maxPrice;
      if (currency === "USD") {
        where.priceUSD = priceFilter as Prisma.ProductWhereInput["priceUSD"];
      } else {
        where.price = priceFilter as Prisma.ProductWhereInput["price"];
      }
    }
    if (badge) {
      where.badge = badge as Prisma.ProductWhereInput["badge"];
    }

    let orderBy: Prisma.ProductOrderByWithRelationInput = {};
    switch (sort) {
      case "price_asc": orderBy = { price: "asc" }; break;
      case "price_desc": orderBy = { price: "desc" }; break;
      case "newest": orderBy = { createdAt: "desc" }; break;
      case "name": orderBy = { name: "asc" }; break;
      default: orderBy = { createdAt: "desc" };
    }

    const { items, total } = await productRepository.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        category: true,
        images: { orderBy: { sortOrder: "asc" }, take: 1 },
      },
    });

    // Enrich with dual currency pricing
    const enriched = items.map((p) => ({
      ...p,
      priceFormatted: currency === "USD"
        ? `$${(Number(p.priceUSD) || convertCurrency(Number(p.price), "IDR", "USD")).toFixed(2)}`
        : `Rp${Number(p.price).toLocaleString("id-ID")}`,
    }));

    return {
      items: enriched,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  async getBySlug(slug: string, currency: Currency = "IDR") {
    const product = await productRepository.findBySlug(slug);
    if (!product) throw new NotFoundError("Product", slug);

    // Track view event
    await analyticsRepository.trackEvent({
      event: "product_view",
      entity: "product",
      entityId: product.publicId,
      metadata: { slug, currency },
    });

    return {
      ...product,
      priceFormatted: currency === "USD"
        ? `$${(Number(product.priceUSD) || convertCurrency(Number(product.price), "IDR", "USD")).toFixed(2)}`
        : `Rp${Number(product.price).toLocaleString("id-ID")}`,
    };
  },

  async getFeatured(limit = 8) {
    return productRepository.getFeatured(limit);
  },

  async getLowStock() {
    return productRepository.getLowStockProducts();
  },
};

// ─── Order Service ──────────────────────────────────────────

export const orderService = {
  async create(data: {
    customerName: string;
    customerEmail?: string;
    customerDiscord?: string;
    customerIGN?: string;
    customerNotes?: string;
    items: Array<{ productId: string; quantity: number }>;
    paymentMethod: string;
    currency?: Currency;
    userId?: string;
  }) {
    // Validate and fetch products
    const products = await Promise.all(
      data.items.map(async (item) => {
        const product = await productRepository.findById(item.productId);
        if (!product) throw new NotFoundError("Product", item.productId);
        if ((product as any).stock < item.quantity) {
          throw new ValidationError(`Insufficient stock for ${(product as any).name}`);
        }
        return { ...(product as any), quantity: item.quantity };
      })
    );

    // Calculate totals
    const subtotal = products.reduce(
      (sum, p) => sum + Number(p.price) * p.quantity, 0
    );
    const tax = Math.round(subtotal * 0.11); // 11% PPN
    const total = subtotal + tax;

    const subtotalUSD = convertCurrency(subtotal, "IDR", "USD");
    const taxUSD = convertCurrency(tax, "IDR", "USD");
    const totalUSD = convertCurrency(total, "IDR", "USD");

    // Generate order number
    const date = new Date();
    const datePart = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    const orderNumber = `LZ-${datePart}-${randomPart}`;

    // Create order with items in a transaction
    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          status: OrderStatus.PENDING,
          customerName: data.customerName,
          customerEmail: data.customerEmail,
          customerDiscord: data.customerDiscord,
          customerIGN: data.customerIGN,
          customerNotes: data.customerNotes,
          subtotal,
          subtotalUSD,
          tax,
          taxUSD,
          total,
          totalUSD,
          currency: data.currency || "IDR",
          paymentMethod: data.paymentMethod as PaymentMethod,
          userId: data.userId,
          items: {
            create: products.map((p) => ({
              productId: p.id,
              name: p.name,
              price: p.price,
              priceUSD: p.priceUSD || convertCurrency(Number(p.price), "IDR", "USD"),
              quantity: p.quantity,
              total: Number(p.price) * p.quantity,
              totalUSD: convertCurrency(Number(p.price) * p.quantity, "IDR", "USD"),
            })),
          },
        },
        include: { items: true },
      });

      // Deduct stock and create inventory logs
      for (const p of products) {
        const previousStock = p.stock;
        const newStock = previousStock - p.quantity;

        await tx.product.update({
          where: { id: p.id },
          data: { stock: newStock },
        });

        await tx.inventoryLog.create({
          data: {
            productId: p.id,
            change: -p.quantity,
            previousStock,
            newStock,
            reason: "ORDER",
            reference: orderNumber,
          },
        });

        // Check for low stock alerts
        if (newStock <= p.minStock) {
          await stockAlertRepository.create({
            productId: p.id,
            type: newStock === 0 ? StockAlertType.OUT_OF_STOCK : StockAlertType.LOW_STOCK,
            threshold: p.minStock,
            currentStock: newStock,
          });
        }
      }

      return newOrder;
    });

    // Track analytics
    await analyticsRepository.trackEvent({
      event: "order_created",
      entity: "order",
      entityId: (order as any).id,
      userId: data.userId,
      metadata: {
        orderNumber,
        total,
        itemCount: products.length,
        paymentMethod: data.paymentMethod,
      },
    });

    return order;
  },

  async updateStatus(id: string, status: string) {
    const order = await orderRepository.findById(id);
    if (!order) throw new NotFoundError("Order", id);

    const updated = await orderRepository.update(id, {
      status: status as OrderStatus,
      ...(status === OrderStatus.PAID ? { paidAt: new Date() } : {}),
      ...(status === OrderStatus.COMPLETED ? { completedAt: new Date() } : {}),
    });

    await activityLogRepository.create({
      action: "ORDER_STATUS_CHANGE",
      entity: "order",
      entityId: id,
      details: JSON.stringify({ from: order.status, to: status }),
    });

    return updated;
  },

  async getStats(storeId?: string) {
    const [statusCounts, recentOrders, totalRevenue] = await Promise.all([
      orderRepository.getStatusCounts(storeId),
      orderRepository.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { items: true },
      }),
      prisma.order.aggregate({
        _sum: { total: true, totalUSD: true },
        _count: { id: true },
        where: {
          status: { in: [OrderStatus.PAID, OrderStatus.COMPLETED] },
          ...(storeId && { storeId }),
        },
      }),
    ]);

    return {
      statusCounts,
      recentOrders: recentOrders.items,
      totalRevenue: totalRevenue._sum.total || 0,
      totalRevenueUSD: totalRevenue._sum.totalUSD || 0,
      totalOrders: totalRevenue._count.id,
    };
  },
};

// ─── Analytics Service ──────────────────────────────────────

export const analyticsService = {
  async getDashboardStats(storeId?: string) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const [
      currentPeriodOrders,
      previousPeriodOrders,
      currentPeriodRevenue,
      previousPeriodRevenue,
      totalProducts,
      lowStockCount,
      totalCustomers,
      newCustomers,
      eventCounts,
    ] = await Promise.all([
      prisma.order.aggregate({
        _count: { id: true },
        where: {
          createdAt: { gte: thirtyDaysAgo },
          ...(storeId && { storeId }),
        },
      }),
      prisma.order.aggregate({
        _count: { id: true },
        where: {
          createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
          ...(storeId && { storeId }),
        },
      }),
      prisma.order.aggregate({
        _sum: { total: true, totalUSD: true },
        where: {
          createdAt: { gte: thirtyDaysAgo },
          status: { in: [OrderStatus.PAID, OrderStatus.COMPLETED] },
          ...(storeId && { storeId }),
        },
      }),
      prisma.order.aggregate({
        _sum: { total: true, totalUSD: true },
        where: {
          createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
          status: { in: [OrderStatus.PAID, OrderStatus.COMPLETED] },
          ...(storeId && { storeId }),
        },
      }),
      prisma.product.count({ where: { isActive: true } }),
      stockAlertRepository.getUnreadCount(storeId),
      userRepository.getCustomerStats(),
      prisma.user.count({
        where: {
          role: Role.CUSTOMER,
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
      analyticsRepository.getEventCounts(thirtyDaysAgo, now),
    ]);

    // Calculate changes
    const revenueChange = previousPeriodRevenue._sum.total
      ? (Number(currentPeriodRevenue._sum.total || 0) - Number(previousPeriodRevenue._sum.total)) /
        Number(previousPeriodRevenue._sum.total) * 100
      : 0;

    const ordersChange = previousPeriodOrders._count.id
      ? ((currentPeriodOrders._count.id || 0) - previousPeriodOrders._count.id) /
        previousPeriodOrders._count.id * 100
      : 0;

    // Get daily revenue for chart (last 30 days)
    // Note: Uses Prisma query instead of raw SQL for SQLite compatibility
    const recentOrders = await prisma.order.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo },
        status: { in: [OrderStatus.PAID, OrderStatus.COMPLETED] },
        ...(storeId && { storeId }),
      },
      select: { total: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    // Aggregate into daily buckets
    const dailyMap = new Map<string, { revenue: number; orders: number }>();
    for (const o of recentOrders) {
      const date = o.createdAt.toISOString().split("T")[0];
      const existing = dailyMap.get(date) || { revenue: 0, orders: 0 };
      existing.revenue += Number(o.total);
      existing.orders += 1;
      dailyMap.set(date, existing);
    }
    const dailyRevenue = Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Get top products
    const topProducts = await prisma.orderItem.groupBy({
      by: ["productId", "name"],
      _sum: { total: true },
      _count: { id: true },
      orderBy: { _sum: { total: "desc" } },
      take: 10,
    });

    // Get payment method distribution
    const paymentMethods = await prisma.order.groupBy({
      by: ["paymentMethod"],
      _count: { id: true },
      where: {
        createdAt: { gte: thirtyDaysAgo },
        paymentMethod: { not: null },
      },
    });

    return {
      overview: {
        totalRevenue: currentPeriodRevenue._sum.total || 0,
        totalRevenueUSD: currentPeriodRevenue._sum.totalUSD || 0,
        totalOrders: currentPeriodOrders._count.id || 0,
        revenueChange: Math.round(revenueChange * 10) / 10,
        ordersChange: Math.round(ordersChange * 10) / 10,
        totalProducts,
        lowStockCount,
        totalCustomers: totalCustomers.total,
        newCustomers,
      },
      charts: {
        dailyRevenue,
        paymentMethods: paymentMethods.map((pm) => ({
          method: pm.paymentMethod,
          count: pm._count.id,
        })),
        topProducts: topProducts.map((tp) => ({
          productId: tp.productId,
          name: tp.name,
          revenue: tp._sum.total || 0,
          orders: tp._count.id,
        })),
      },
      events: eventCounts,
    };
  },

  async getRevenueChart(startDate: Date, endDate: Date, storeId?: string) {
    return orderRepository.getRevenueByDateRange(startDate, endDate, storeId);
  },
};

// ─── Stock Alert Service ────────────────────────────────────

export const stockAlertService = {
  async checkAndCreateAlerts(storeId?: string) {
    const lowStockProducts = await productRepository.getLowStockProducts(storeId);
    const alerts: Array<{ productId: string; productName: string; currentStock: number; threshold: number }> = [];

    for (const product of lowStockProducts) {
      const existingAlert = await stockAlertRepository.findMany({
        where: {
          productId: product.id,
          isRead: false,
        },
      });

      if (existingAlert.items.length === 0) {
        await stockAlertRepository.create({
          productId: product.id,
          type: product.stock === 0 ? StockAlertType.OUT_OF_STOCK : StockAlertType.LOW_STOCK,
          threshold: product.minStock,
          currentStock: product.stock,
          storeId,
        });
        alerts.push({
          productId: product.id,
          productName: product.name,
          currentStock: product.stock,
          threshold: product.minStock,
        });
      }
    }

    return alerts;
  },

  async getAlerts(storeId?: string) {
    return stockAlertRepository.findMany({
      where: {
        isRead: false,
        ...(storeId ? { storeId } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async markAsRead(id: string) {
    return stockAlertRepository.markAsRead(id);
  },
};

// ─── Notification Service ───────────────────────────────────

export const notificationService = {
  async sendTelegram(message: string, storeId?: string) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      console.warn("Telegram not configured, skipping notification");
      return null;
    }

    const notification = await notificationRepository.create({
      channel: NotificationChannel.SMS,
      recipient: chatId,
      subject: "LEIZ STORE Notification",
      body: message,
      storeId: storeId,
    });

    try {
      const res = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: "HTML",
          }),
        }
      );

      if (res.ok) {
        await notificationRepository.markAsSent(notification.publicId);
      } else {
        await notificationRepository.markAsFailed(notification.publicId);
      }
      return notification;
    } catch (error) {
      await notificationRepository.markAsFailed(notification.publicId);
      return null;
    }
  },

  async sendDiscord(message: string, webhookUrl?: string) {
    const url = webhookUrl || process.env.DISCORD_WEBHOOK_URL;

    if (!url) {
      console.warn("Discord webhook not configured, skipping notification");
      return null;
    }

    const notification = await notificationRepository.create({
      channel: NotificationChannel.DISCORD,
      recipient: "webhook",
      subject: "LEIZ STORE Notification",
      body: message,
    });

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: message }),
      });

      if (res.ok) {
        await notificationRepository.markAsSent(notification.publicId);
      } else {
        await notificationRepository.markAsFailed(notification.publicId);
      }
      return notification;
    } catch {
      await notificationRepository.markAsFailed(notification.publicId);
      return null;
    }
  },

  async sendWhatsApp(phoneNumber: string, message: string) {
    const apiKey = process.env.WHATSAPP_API_KEY;
    const apiUrl = process.env.WHATSAPP_API_URL;

    if (!apiKey || !apiUrl) {
      console.warn("WhatsApp not configured, skipping notification");
      return null;
    }

    const notification = await notificationRepository.create({
      channel: NotificationChannel.WHATSAPP,
      recipient: phoneNumber,
      subject: "LEIZ STORE Order Update",
      body: message,
    });

    try {
      const res = await fetch(apiUrl, {
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

      if (res.ok) {
        await notificationRepository.markAsSent(notification.publicId);
      } else {
        await notificationRepository.markAsFailed(notification.publicId);
      }
      return notification;
    } catch {
      await notificationRepository.markAsFailed(notification.publicId);
      return null;
    }
  },

  async sendOrderConfirmation(order: {
    orderNumber: string;
    customerName: string;
    customerDiscord?: string;
    total: number;
    paymentMethod: string;
  }) {
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

    // Send to all configured channels
    await Promise.allSettled([
      notificationService.sendTelegram(message),
      notificationService.sendDiscord(message),
    ]);
  },

  async sendStockAlert(alert: {
    productName: string;
    currentStock: number;
    threshold: number;
  }) {
    const message = [
      `⚠️ *Stock Alert*`,
      ``,
      `📦 Product: ${alert.productName}`,
      `📊 Current Stock: ${alert.currentStock}`,
      `🔔 Threshold: ${alert.threshold}`,
      ``,
      alert.currentStock === 0
        ? `❌ *OUT OF STOCK*`
        : `⚠️ *LOW STOCK*`,
    ].join("\n");

    await notificationService.sendTelegram(message);
  },
};

// ─── Customer Segment Service ───────────────────────────────

export const customerSegmentService = {
  async calculateSegments() {
    const customers = await prisma.user.findMany({
      where: { role: Role.CUSTOMER },
      include: {
        orders: {
          select: {
            total: true,
            createdAt: true,
            status: true,
          },
          where: { status: { in: [OrderStatus.PAID, OrderStatus.COMPLETED] } },
        },
      },
    });

    const now = new Date();
    const segments: Array<{
      userId: string;
      segment: string;
      rfmScore: string;
      frequency: number;
      monetary: number;
      recencyDays: number;
      lifetimeValue: number;
    }> = [];

    for (const customer of customers) {
      if (customer.orders.length === 0) {
        segments.push({
          userId: customer.id,
          segment: "new",
          rfmScore: "111",
          frequency: 0,
          monetary: 0,
          recencyDays: 999,
          lifetimeValue: 0,
        });
        continue;
      }

      // Calculate RFM
      const lastOrder = customer.orders.reduce((latest: any, order: any) =>
        order.createdAt > latest.createdAt ? order : latest
      );
      const recencyDays = Math.floor(
        (now.getTime() - lastOrder.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      const frequency = customer.orders.length;
      const monetary = customer.orders.reduce((sum: number, o: any) => sum + Number(o.total), 0);

      // Score 1-5 for each dimension
      const recencyScore = recencyDays <= 7 ? 5 : recencyDays <= 30 ? 4 : recencyDays <= 90 ? 3 : recencyDays <= 180 ? 2 : 1;
      const frequencyScore = frequency >= 10 ? 5 : frequency >= 5 ? 4 : frequency >= 3 ? 3 : frequency >= 2 ? 2 : 1;
      const monetaryNum = Number(monetary);
      const monetaryScore = monetaryNum >= 5000000 ? 5 : monetaryNum >= 2000000 ? 4 : monetaryNum >= 1000000 ? 3 : monetaryNum >= 500000 ? 2 : 1;

      const rfmScore = `${recencyScore}${frequencyScore}${monetaryScore}`;
      const avgScore = (recencyScore + frequencyScore + monetaryScore) / 3;

      // Segment classification
      let segment: string;
      if (avgScore >= 4) segment = "champion";
      else if (avgScore >= 3.5 && recencyScore >= 4) segment = "loyal";
      else if (avgScore >= 3) segment = "potential_loyalist";
      else if (frequencyScore >= 3 && recencyScore <= 2) segment = "at_risk";
      else if (frequencyScore <= 2 && recencyScore <= 2) segment = "hibernating";
      else if (frequencyScore === 1 && monetaryScore >= 3) segment = "new_high_value";
      else segment = "need_attention";

      segments.push({
        userId: customer.id,
        segment,
        rfmScore,
        frequency,
        monetary,
        recencyDays,
        lifetimeValue: monetary,
      });
    }

    // Upsert all segments
    for (const seg of segments) {
      await customerSegmentRepository.upsert(seg);
    }

    return customerSegmentRepository.getSegmentCounts();
  },

  async getSegmentCounts() {
    return customerSegmentRepository.getSegmentCounts();
  },

  async getCustomersBySegment(segment: string) {
    return customerSegmentRepository.findMany({
      where: { segment },
      orderBy: { lifetimeValue: "desc" },
    });
  },
};

// ─── Sales Forecast Service ─────────────────────────────────

export const forecastService = {
  async generateForecasts(storeId?: string) {
    // Get daily sales for last 90 days
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    // Use Prisma query
    const forecastOrders = await prisma.order.findMany({
      where: {
        createdAt: { gte: ninetyDaysAgo },
        status: { in: [OrderStatus.PAID, OrderStatus.COMPLETED] },
        ...(storeId && { storeId }),
      },
      select: { total: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    // Aggregate into daily buckets
    const dailyMap = new Map<string, { total: number; count: number }>();
    for (const o of forecastOrders) {
      const date = o.createdAt.toISOString().split("T")[0];
      const existing = dailyMap.get(date) || { total: 0, count: 0 };
      existing.total += Number(o.total);
      existing.count += 1;
      dailyMap.set(date, existing);
    }
    const dailySales = Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, ...data }));

    if (dailySales.length < 7) {
      return { forecasts: [], dataPoints: dailySales.length };
    }

    // Simple Moving Average (7-day)
    const values = dailySales.map((d) => d.total);
    const forecasts: Array<{
      period: string;
      predictedValue: number;
      confidence: number;
      algorithm: string;
    }> = [];

    const windowSize = 7;
    for (let i = 0; i < windowSize; i++) {
      const window = values.slice(
        Math.max(0, values.length - windowSize - i),
        values.length - i
      );
      const avg = window.reduce((s, v) => s + v, 0) / window.length;
      const forecastDate = new Date();
      forecastDate.setDate(forecastDate.getDate() + i + 1);

      forecasts.push({
        period: forecastDate.toISOString().split("T")[0],
        predictedValue: Math.round(avg),
        confidence: Math.max(0.5, 0.95 - i * 0.05),
        algorithm: "moving_average_7d",
      });
    }

    // Store forecasts
    for (const f of forecasts) {
      await forecastRepository.create({
        period: f.period,
        predictedValue: f.predictedValue,
        confidence: f.confidence,
        algorithm: f.algorithm,
        storeId,
      });
    }

    return { forecasts, dataPoints: values.length };
  },

  async getLatestForecasts(storeId?: string) {
    return forecastRepository.findMany({
      where: { storeId },
      orderBy: { createdAt: "desc" },
      take: 14,
    });
  },
};

// ─── Recommendation Service ─────────────────────────────────

export const recommendationService = {
  async generateRecommendations() {
    // Get all orders with items
    const orders = await prisma.order.findMany({
      where: { status: { in: [OrderStatus.PAID, OrderStatus.COMPLETED] } },
      include: { items: { select: { productId: true } } },
    });

    // Build co-occurrence matrix
    const coOccurrence = new Map<string, Map<string, number>>();

    for (const order of orders) {
      const productIds = (order as any).items.map((i: any) => String(i.productId));
      for (let i = 0; i < productIds.length; i++) {
        for (let j = 0; j < productIds.length; j++) {
          if (i === j) continue;
          const key = productIds[i];
          const target = productIds[j];
          if (!coOccurrence.has(key)) coOccurrence.set(key, new Map());
          const current = coOccurrence.get(key)!.get(target) || 0;
          coOccurrence.get(key)!.set(target, current + 1);
        }
      }
    }

    // Generate recommendations based on co-occurrence
    const recommendations: Array<{
      sourceProductId: string;
      recommendedProductId: string;
      score: number;
    }> = [];

    for (const [sourceId, targets] of coOccurrence) {
      const sortedTargets = [...targets.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      const maxScore = sortedTargets[0]?.[1] || 1;

      for (const [targetId, count] of sortedTargets) {
        recommendations.push({
          sourceProductId: sourceId,
          recommendedProductId: targetId,
          score: count / maxScore,
        });
      }
    }

    // Store recommendations
    for (const rec of recommendations) {
      await recommendationRepository.create({
        ...rec,
        algorithm: "association",
      });
    }

    return { count: recommendations.length };
  },

  async getForProduct(productId: string, limit = 6) {
    return recommendationRepository.getForProduct(productId, limit);
  },
};
