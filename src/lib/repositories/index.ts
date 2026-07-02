/**
 * Repository Pattern
 * Abstracts data access layer from business logic
 */

import { prisma } from "@/lib/db";
import type {
  Prisma,
} from "@/lib/prisma-types";
import {
  Role,
  OrderStatus,
  StockAlertType,
} from "@/lib/prisma-types";

// ─── Typed Repository Args ───────────────────────────────────
// Each repository gets its own args type picked from Prisma's generated types

type ProductFindManyArgs = Pick<Prisma.ProductFindManyArgs, 'where' | 'orderBy' | 'skip' | 'take' | 'include' | 'select'>;
type CategoryFindManyArgs = Pick<Prisma.CategoryFindManyArgs, 'where' | 'orderBy' | 'skip' | 'take'>;
type OrderFindManyArgs = Pick<Prisma.OrderFindManyArgs, 'where' | 'orderBy' | 'skip' | 'take' | 'include'>;
type UserFindManyArgs = Pick<Prisma.UserFindManyArgs, 'where' | 'orderBy' | 'skip' | 'take'>;
type ActivityLogFindManyArgs = Pick<Prisma.ActivityLogFindManyArgs, 'where' | 'orderBy' | 'skip' | 'take'>;
type InventoryLogFindManyArgs = Pick<Prisma.InventoryLogFindManyArgs, 'where' | 'orderBy' | 'skip' | 'take'>;
type AnalyticsEventFindManyArgs = Pick<Prisma.AnalyticsEventFindManyArgs, 'where' | 'orderBy' | 'skip' | 'take'>;
type StockAlertFindManyArgs = Pick<Prisma.StockAlertFindManyArgs, 'where' | 'orderBy' | 'skip' | 'take'>;
type NotificationFindManyArgs = Pick<Prisma.NotificationFindManyArgs, 'where' | 'orderBy' | 'skip' | 'take'>;
type SalesForecastFindManyArgs = Pick<Prisma.SalesForecastFindManyArgs, 'where' | 'orderBy' | 'skip' | 'take'>;
type CustomerSegmentFindManyArgs = Pick<Prisma.CustomerSegmentFindManyArgs, 'where' | 'orderBy' | 'skip' | 'take'>;
type ProductRecommendationFindManyArgs = Pick<Prisma.ProductRecommendationFindManyArgs, 'where' | 'orderBy' | 'skip' | 'take' | 'include'>;

// ─── Product Repository ─────────────────────────────────────

export const productRepository = {
  async findMany(options: ProductFindManyArgs = {}) {
    const { where, orderBy, skip, take, include, select } = options;
    const args: Prisma.ProductFindManyArgs = {
      where,
      orderBy,
      skip,
      take,
      ...(select ? { select } : { include }),
    };
    const [items, total] = await Promise.all([
      prisma.product.findMany(args),
      prisma.product.count({ where }),
    ]);
    return { items, total };
  },

  async findBySlug(slug: string) {
    return prisma.product.findUnique({
      where: { slug },
      include: {
        category: true,
        images: { orderBy: { sortOrder: "asc" } },
      },
    });
  },

  async findById(id: string) {
    return prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        images: { orderBy: { sortOrder: "asc" } },
      },
    });
  },

  async create(data: Prisma.ProductCreateInput) {
    return prisma.product.create({ data });
  },

  async update(id: string, data: Prisma.ProductUpdateInput) {
    return prisma.product.update({ where: { id }, data });
  },

  async delete(id: string) {
    return prisma.product.delete({ where: { id } });
  },

  async getLowStockProducts(storeId?: string) {
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        ...(storeId && { storeId }),
      },
      include: { category: true },
    });
    return products.filter((p: any) => p.stock <= p.minStock);
  },

  async getFeatured(limit = 8) {
    return prisma.product.findMany({
      where: { isActive: true, isFeatured: true },
      include: {
        category: true,
        images: { orderBy: { sortOrder: "asc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },

  async search(query: string, options: Partial<ProductFindManyArgs> = {}) {
    const { where: _where, ...rest } = options;
    const where: Prisma.ProductWhereInput = {
      isActive: true,
      OR: [
        { name: { contains: query } },
        { description: { contains: query } },
      ],
    };
    return this.findMany({ ...rest, where });
  },
};

// ─── Category Repository ────────────────────────────────────

export const categoryRepository = {
  async findMany(options: CategoryFindManyArgs = {}) {
    const { where, orderBy, skip, take } = options;
    const [items, total] = await Promise.all([
      prisma.category.findMany({
        where,
        orderBy,
        skip,
        take,
        include: { _count: { select: { products: true } } },
      }),
      prisma.category.count({ where }),
    ]);
    return { items, total };
  },

  async findBySlug(slug: string) {
    return prisma.category.findUnique({
      where: { slug },
      include: {
        children: true,
        parent: true,
        _count: { select: { products: true } },
      },
    });
  },

  async findRoots() {
    return prisma.category.findMany({
      where: { parentId: null, isActive: true },
      orderBy: { sortOrder: "asc" },
      include: {
        children: { orderBy: { sortOrder: "asc" } },
        _count: { select: { products: true } },
      },
    });
  },

  async create(data: Prisma.CategoryCreateInput) {
    return prisma.category.create({ data });
  },

  async update(id: string, data: Prisma.CategoryUpdateInput) {
    return prisma.category.update({ where: { id }, data });
  },

  async delete(id: string) {
    return prisma.category.delete({ where: { id } });
  },
};

// ─── Order Repository ───────────────────────────────────────

export const orderRepository = {
  async findMany(options: OrderFindManyArgs = {}) {
    const { where, orderBy, skip, take, include } = options;
    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy,
        skip,
        take,
        include,
      }),
      prisma.order.count({ where }),
    ]);
    return { items, total };
  },

  async findById(id: string) {
    return prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { product: { include: { images: true } } } },
        payment: true,
        user: true,
      },
    });
  },

  async findByOrderNumber(orderNumber: string) {
    return prisma.order.findUnique({
      where: { orderNumber },
      include: {
        items: { include: { product: { include: { images: true } } } },
        payment: true,
      },
    });
  },

  async create(data: Prisma.OrderCreateInput) {
    return prisma.order.create({ data });
  },

  async update(id: string, data: Prisma.OrderUpdateInput) {
    return prisma.order.update({ where: { id }, data });
  },

  async getStatusCounts(storeId?: string) {
    const where = storeId ? { storeId } : {};
    const counts = await prisma.order.groupBy({
      by: ["status"],
      _count: { id: true },
      where,
    });
    return Object.fromEntries(counts.map((c: any) => [c.status, c._count.id]));
  },

  async getRevenueByDateRange(startDate: Date, endDate: Date, storeId?: string) {
    return prisma.order.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        status: { in: [OrderStatus.PAID, OrderStatus.COMPLETED] },
        ...(storeId && { storeId }),
      },
      select: { total: true, totalUSD: true, createdAt: true, currency: true },
      orderBy: { createdAt: "asc" },
    });
  },
};

// ─── User Repository ────────────────────────────────────────

export const userRepository = {
  async findMany(options: UserFindManyArgs = {}) {
    const { where, orderBy, skip, take } = options;
    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy,
        skip,
        take,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          avatar: true,
          discord: true,
          phone: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          _count: { select: { orders: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);
    return { items, total };
  },

  async findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },

  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: {
        _count: { select: { orders: true, wishlist: true } },
      },
    });
  },

  async create(data: Prisma.UserCreateInput) {
    return prisma.user.create({ data });
  },

  async update(id: string, data: Prisma.UserUpdateInput) {
    return prisma.user.update({ where: { id }, data });
  },

  async getCustomerStats() {
    const total = await prisma.user.count({ where: { role: Role.CUSTOMER } });
    const active = await prisma.user.count({
      where: { role: Role.CUSTOMER, isActive: true },
    });
    const newThisMonth = await prisma.user.count({
      where: {
        role: Role.CUSTOMER,
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    });
    return { total, active, newThisMonth };
  },
};

// ─── Activity Log Repository ────────────────────────────────

export const activityLogRepository = {
  async findMany(options: ActivityLogFindManyArgs = {}) {
    const { where, orderBy, skip, take } = options;
    const [items, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy,
        skip,
        take,
        include: { user: { select: { name: true, email: true } } },
      }),
      prisma.activityLog.count({ where }),
    ]);
    return { items, total };
  },

  async create(data: {
    userId?: string;
    action: string;
    entity?: string;
    entityId?: string;
    details?: string;
    ipAddress?: string;
    userAgent?: string;
    storeId?: string;
  }) {
    return prisma.activityLog.create({ data });
  },
};

// ─── Inventory Log Repository ───────────────────────────────

export const inventoryLogRepository = {
  async findMany(options: InventoryLogFindManyArgs = {}) {
    const { where, orderBy, skip, take } = options;
    const [items, total] = await Promise.all([
      prisma.inventoryLog.findMany({
        where,
        orderBy,
        skip,
        take,
        include: { product: { select: { name: true, slug: true } } },
      }),
      prisma.inventoryLog.count({ where }),
    ]);
    return { items, total };
  },

  async create(data: {
    productId: string;
    change: number;
    previousStock: number;
    newStock: number;
    reason: string;
    reference?: string;
    userId?: string;
  }) {
    return prisma.inventoryLog.create({ data });
  },
};

// ─── Setting Repository ─────────────────────────────────────

export const settingRepository = {
  async get(key: string) {
    const setting = await prisma.setting.findUnique({ where: { key } });
    return setting?.value;
  },

  async set(key: string, value: string, type = "text", group = "general") {
    return prisma.setting.upsert({
      where: { key },
      update: { value, type, group },
      create: { key, value, type, group },
    });
  },

  async getMany(groupName: string) {
    const all = await prisma.setting.findMany({});
    return all.filter((s: any) => (s.group || s.groupName) === groupName);
  },

  async getMap(groupName: string) {
    const settings = await prisma.setting.findMany({});
    return Object.fromEntries(
      settings
        .filter((s: any) => (s.group || s.groupName) === groupName)
        .map((s: any) => [s.key, s.value])
    );
  },
};

// ─── Analytics Repository ───────────────────────────────────

export const analyticsRepository = {
  async trackEvent(data: {
    event: string;
    entity?: string;
    entityId?: string;
    userId?: string;
    metadata?: Prisma.InputJsonValue;
    storeId?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return prisma.analyticsEvent.create({ data });
  },

  async getEvents(options: AnalyticsEventFindManyArgs = {}) {
    const { where, orderBy, skip, take } = options;
    const [items, total] = await Promise.all([
      prisma.analyticsEvent.findMany({
        where,
        orderBy,
        skip,
        take,
      }),
      prisma.analyticsEvent.count({ where }),
    ]);
    return { items, total };
  },

  async getEventCounts(startDate: Date, endDate: Date) {
    const events = await prisma.analyticsEvent.groupBy({
      by: ["event"],
      _count: { id: true },
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
    });
    return Object.fromEntries(events.map((e: any) => [e.event, e._count.id]));
  },
};

// ─── Stock Alert Repository ─────────────────────────────────

export const stockAlertRepository = {
  async findMany(options: StockAlertFindManyArgs = {}) {
    const { where, orderBy, skip, take } = options;
    const [items, total] = await Promise.all([
      prisma.stockAlert.findMany({
        where,
        orderBy,
        skip,
        take,
      }),
      prisma.stockAlert.count({ where }),
    ]);
    return { items, total };
  },

  async create(data: {
    productId: string;
    type?: StockAlertType;
    threshold?: number;
    currentStock: number;
    storeId?: string;
  }) {
    return prisma.stockAlert.create({ data });
  },

  async markAsRead(id: string) {
    return prisma.stockAlert.update({
      where: { id },
      data: { isRead: true },
    });
  },

  async markAsSent(id: string, via: string) {
    return prisma.stockAlert.update({
      where: { id },
      data: { isSent: true, sentVia: via },
    });
  },

  async getUnreadCount(storeId?: string) {
    return prisma.stockAlert.count({
      where: {
        isRead: false,
        ...(storeId && { storeId }),
      },
    });
  },
};

// ─── Notification Repository ────────────────────────────────

export const notificationRepository = {
  async findMany(options: NotificationFindManyArgs = {}) {
    const { where, orderBy, skip, take } = options;
    const [items, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy,
        skip,
        take,
      }),
      prisma.notification.count({ where }),
    ]);
    return { items, total };
  },

  async create(data: {
    channel: NotificationChannel;
    recipient: string;
    subject: string;
    body: string;
    metadata?: Prisma.InputJsonValue;
    storeId?: string;
  }) {
    return prisma.notification.create({ data });
  },

  async markAsSent(id: string) {
    return prisma.notification.update({
      where: { id },
      data: { status: NotificationStatus.SENT, sentAt: new Date() },
    });
  },

  async markAsFailed(id: string) {
    return prisma.notification.update({
      where: { id },
      data: { status: NotificationStatus.FAILED },
    });
  },
};

// ─── Currency Rate Repository ───────────────────────────────

export const currencyRateRepository = {
  async getRate(from: string, to: string) {
    if (from === to) return 1;
    const rate = await prisma.currencyRate.findUnique({
      where: { id: `${from}_${to}` },
    });
    return rate?.rate;
  },

  async setRate(from: string, to: string, rate: number, source = "api") {
    return prisma.currencyRate.upsert({
      where: { id: `${from}_${to}` },
      update: { rate, source, updatedAt: new Date() },
      create: { id: `${from}_${to}`, from, to, rate, source },
    });
  },

  async getAllRates() {
    return prisma.currencyRate.findMany();
  },
};

// ─── Forecast Repository ────────────────────────────────────

export const forecastRepository = {
  async findMany(options: SalesForecastFindManyArgs = {}) {
    const { where, orderBy, skip, take } = options;
    const [items, total] = await Promise.all([
      prisma.salesForecast.findMany({
        where,
        orderBy,
        skip,
        take,
      }),
      prisma.salesForecast.count({ where }),
    ]);
    return { items, total };
  },

  async create(data: {
    productId?: string;
    categoryId?: string;
    storeId?: string;
    period: string;
    predictedValue: number;
    actualValue?: number;
    confidence?: number;
    algorithm?: string;
  }) {
    return prisma.salesForecast.create({ data });
  },
};

// ─── Customer Segment Repository ────────────────────────────

export const customerSegmentRepository = {
  async findMany(options: CustomerSegmentFindManyArgs = {}) {
    const { where, orderBy, skip, take } = options;
    const [items, total] = await Promise.all([
      prisma.customerSegment.findMany({
        where,
        orderBy,
        skip,
        take,
      }),
      prisma.customerSegment.count({ where }),
    ]);
    return { items, total };
  },

  async upsert(data: {
    userId: string;
    segment: string;
    rfmScore: string;
    frequency: number;
    monetary: number;
    recencyDays: number;
    lifetimeValue: number;
  }) {
    return prisma.customerSegment.upsert({
      where: { userId: data.userId },
      update: { ...data, lastCalculated: new Date() },
      create: data,
    });
  },

  async getSegmentCounts() {
    const counts = await prisma.customerSegment.groupBy({
      by: ["segment"],
      _count: { id: true },
      _avg: { lifetimeValue: true },
    });
    return counts.map((c: any) => ({
      segment: c.segment,
      count: c._count.id,
      avgLifetimeValue: c._avg.lifetimeValue,
    }));
  },
};

// ─── Recommendation Repository ──────────────────────────────

export const recommendationRepository = {
  async findMany(options: ProductRecommendationFindManyArgs = {}) {
    const { where, orderBy, skip, take, include } = options;
    const [items, total] = await Promise.all([
      prisma.productRecommendation.findMany({
        where,
        orderBy,
        skip,
        take,
        include: include ?? {
          sourceProduct: true,
          recommendedProduct: {
            include: { images: { take: 1, orderBy: { sortOrder: "asc" } } },
          },
        },
      }),
      prisma.productRecommendation.count({ where }),
    ]);
    return { items, total };
  },

  async getForProduct(productId: string, limit = 6) {
    return prisma.productRecommendation.findMany({
      where: {
        sourceProductId: productId,
        isActive: true,
      },
      include: {
        recommendedProduct: {
          include: {
            category: true,
            images: { take: 1, orderBy: { sortOrder: "asc" } },
          },
        },
      },
      orderBy: { score: "desc" },
      take: limit,
    });
  },

  async create(data: {
    sourceProductId: string;
    recommendedProductId: string;
    score: number;
    algorithm?: string;
  }) {
    return prisma.productRecommendation.upsert({
      where: {
        id: `${data.sourceProductId}_${data.recommendedProductId}`,
      },
      update: { score: data.score, algorithm: data.algorithm },
      create: {
        id: `${data.sourceProductId}_${data.recommendedProductId}`,
        ...data,
      },
    });
  },
};
