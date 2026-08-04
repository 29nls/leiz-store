import { productService, orderService } from "@/lib/services";
import { prisma } from "@/lib/db";
import { orderRepository } from "@/lib/repositories";
import { encryptPaymentToken } from "@/lib/order-idempotency";

jest.mock("@/lib/repositories", () => {
  const actual = jest.requireActual("@/lib/repositories");
  return {
    ...actual,
    orderRepository: {
      ...actual.orderRepository,
      createAtomic: jest.fn(),
    },
  };
});

jest.mock("@/lib/payment/order-logger", () => ({
  logOrderStatusChange: jest.fn().mockResolvedValue(undefined),
}));

// Mock is in jest.setup.ts - prisma is already mocked

describe("Product Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("list", () => {
    it("should return paginated products with defaults", async () => {
      const mockProducts = [
        { id: "p1", name: "Test Product", price: 100000, priceUSD: 6.3, isActive: true },
      ];

      (prisma.product.findMany as jest.Mock).mockResolvedValue(mockProducts);
      (prisma.product.count as jest.Mock).mockResolvedValue(1);

      const result = await productService.list({});

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it("should apply search filter", async () => {
      (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.product.count as jest.Mock).mockResolvedValue(0);

      await productService.list({ search: "test" });

      const args = (prisma.product.findMany as jest.Mock).mock.calls[0][0];
      expect(args.where.OR).toBeDefined();
      expect(args.where.OR[0].name.contains).toBe("test");
    });

    it("should apply category filter", async () => {
      (prisma.category.findUnique as jest.Mock).mockResolvedValue({ id: "cat-1" });
      (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.product.count as jest.Mock).mockResolvedValue(0);

      await productService.list({ category: "skins" });

      const args = (prisma.product.findMany as jest.Mock).mock.calls[0][0];
      expect(args.where.categoryId).toBe("cat-1");
    });

    it("should apply price filtering", async () => {
      (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.product.count as jest.Mock).mockResolvedValue(0);

      await productService.list({ minPrice: 50000, maxPrice: 200000 });

      const args = (prisma.product.findMany as jest.Mock).mock.calls[0][0];
      expect(args.where.price.gte).toBe(50000);
      expect(args.where.price.lte).toBe(200000);
    });

    it("should sort by newest by default", async () => {
      (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.product.count as jest.Mock).mockResolvedValue(0);

      await productService.list({ sort: "newest" });

      const args = (prisma.product.findMany as jest.Mock).mock.calls[0][0];
      expect(args.orderBy.createdAt).toBe("desc");
    });

    it("should sort by price ascending", async () => {
      (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.product.count as jest.Mock).mockResolvedValue(0);

      await productService.list({ sort: "price_asc" });

      const args = (prisma.product.findMany as jest.Mock).mock.calls[0][0];
      expect(args.orderBy.price).toBe("asc");
    });

    it("should filter by badge", async () => {
      (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.product.count as jest.Mock).mockResolvedValue(0);

      await productService.list({ badge: "HOT" });

      const args = (prisma.product.findMany as jest.Mock).mock.calls[0][0];
      expect(args.where.badge).toBe("HOT");
    });
  });

  describe("getBySlug", () => {
    it("should return product by slug", async () => {
      const mockProduct = {
        id: "p1",
        publicId: "p1",
        name: "Test Product",
        slug: "test-product",
        price: 100000,
        isActive: true,
      };

      (prisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct);

      const result = await productService.getBySlug("test-product");

      expect(result).toBeDefined();
      expect(result.priceFormatted).toContain("Rp");
    });

    it("should track view event", async () => {
      const mockProduct = {
        id: "p1",
        publicId: "p1",
        name: "Test Product",
        slug: "test-product",
        price: 100000,
        isActive: true,
      };

      (prisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct);

      await productService.getBySlug("test-product");

      expect(prisma.analyticsEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            event: "product_view",
            entity: "product",
            entityId: "p1",
          }),
        })
      );
    });

    it("should throw NotFoundError for missing product", async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(productService.getBySlug("non-existent")).rejects.toThrow(
        /not found/i
      );
    });
  });
});

describe("Order Service", () => {
  const mockProduct = {
    id: "p1",
    name: "Test Product",
    price: 100000,
    priceUSD: 6.3,
    stock: 50,
    minStock: 5,
    isActive: true,
  };

  const orderInput = {
    customerName: "Test Customer",
    customerDiscord: "123456789012345678",
    items: [{ productId: "p1", quantity: 2 }],
    paymentMethod: "bank_transfer",
    currency: "IDR" as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct);
    (prisma.analyticsEvent.create as jest.Mock).mockResolvedValue({});
    delete process.env.PAYMENT_IDEMPOTENCY_ENCRYPTION_KEY;
  });

  describe("create", () => {
    it("should create an order successfully", async () => {
      (orderRepository.createAtomic as jest.Mock).mockResolvedValue({
        order: { id: "order-1", orderNumber: "LZ-20240101-ABC123", status: "PENDING_PAYMENT", subtotal: 200000 },
        replayed: false,
        encryptedPaymentToken: null,
      });

      const result = await orderService.create(orderInput);

      expect(result.order.status).toBe("PENDING_PAYMENT");
      expect(result.paymentConfirmationToken).toEqual(expect.any(String));
      expect(orderRepository.createAtomic).toHaveBeenCalledWith(expect.objectContaining({
        items: [{ product_id: "p1", quantity: 2 }],
      }));
    });

    it("does not reject keyed retries based on a stale stock preflight", async () => {
      process.env.PAYMENT_IDEMPOTENCY_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
      (orderRepository.createAtomic as jest.Mock).mockResolvedValue({
        order: { id: "order-1", status: "PENDING_PAYMENT", subtotal: 200000 },
        replayed: false,
        encryptedPaymentToken: "unused",
      });

      await orderService.create(orderInput, {
        idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
      });

      expect(orderRepository.createAtomic).toHaveBeenCalledWith(expect.objectContaining({
        idempotency: expect.objectContaining({
          key: "550e8400-e29b-41d4-a716-446655440000",
          fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      }));
    });

    it("returns a replay without changing status or duplicating side effects", async () => {
      (orderRepository.createAtomic as jest.Mock).mockResolvedValue({
        order: { id: "order-1", status: "WAITING_CONFIRMATION", subtotal: 200000 },
        replayed: true,
        encryptedPaymentToken: null,
      });
      process.env.PAYMENT_IDEMPOTENCY_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
      (orderRepository.createAtomic as jest.Mock).mockResolvedValue({
        order: { id: "order-1", status: "WAITING_CONFIRMATION", subtotal: 200000 },
        replayed: true,
        encryptedPaymentToken: encryptPaymentToken("replayed-token"),
      });

      const result = await orderService.create(orderInput, {
        idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
      });

      expect(result.order.status).toBe("WAITING_CONFIRMATION");
      expect(result.paymentConfirmationToken).toBe("replayed-token");
      expect(prisma.analyticsEvent.create).not.toHaveBeenCalled();
    });

    it("keeps a committed order successful when analytics fails", async () => {
      (orderRepository.createAtomic as jest.Mock).mockResolvedValue({
        order: { id: "order-1", status: "PENDING_PAYMENT", subtotal: 200000 },
        replayed: false,
        encryptedPaymentToken: null,
      });
      (prisma.analyticsEvent.create as jest.Mock).mockRejectedValue(new Error("analytics down"));

      await expect(orderService.create(orderInput)).resolves.toEqual(expect.objectContaining({
        order: expect.objectContaining({ id: "order-1" }),
      }));
    });

    it("should throw NotFoundError for invalid product", async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        orderService.create({
          ...orderInput,
          items: [{ productId: "invalid", quantity: 1 }],
        })
      ).rejects.toThrow(/not found/i);
    });

    it("should throw ValidationError for insufficient stock", async () => {
      const lowStockProduct = { ...mockProduct, stock: 1 };
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(lowStockProduct);

      await expect(orderService.create(orderInput)).rejects.toThrow(/stock|insufficient/i);
    });
  });
});
