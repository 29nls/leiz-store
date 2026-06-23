import { productService, orderService } from "@/lib/services";
import { prisma } from "@/lib/db";

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
      (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.product.count as jest.Mock).mockResolvedValue(0);

      await productService.list({ category: "skins" });

      const args = (prisma.product.findMany as jest.Mock).mock.calls[0][0];
      expect(args.where.category.slug).toBe("skins");
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create an order successfully", async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct);
      (prisma.$transaction as jest.Mock).mockImplementation((cb) =>
        cb({
          order: {
            create: jest.fn().mockResolvedValue({
              id: "order-1",
              orderNumber: "LZ-20240101-ABC123",
              status: "PENDING",
              items: [{ id: "item-1" }],
            }),
          },
          product: { update: jest.fn().mockResolvedValue({}) },
          inventoryLog: { create: jest.fn().mockResolvedValue({}) },
        })
      );
      (prisma.analyticsEvent.create as jest.Mock).mockResolvedValue({});

      const result = await orderService.create({
        customerName: "Test Customer",
        items: [{ productId: "p1", quantity: 2 }],
        paymentMethod: "QRIS",
      });

      expect(result).toBeDefined();
      expect(result.status).toBe("PENDING");
    });

    it("should throw NotFoundError for invalid product", async () => {
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        orderService.create({
          customerName: "Test Customer",
          items: [{ productId: "invalid", quantity: 1 }],
          paymentMethod: "QRIS",
        })
      ).rejects.toThrow(/not found/i);
    });

    it("should throw ValidationError for insufficient stock", async () => {
      const lowStockProduct = { ...mockProduct, stock: 1 };
      (prisma.product.findUnique as jest.Mock).mockResolvedValue(lowStockProduct);

      await expect(
        orderService.create({
          customerName: "Test Customer",
          items: [{ productId: "p1", quantity: 5 }],
          paymentMethod: "QRIS",
        })
      ).rejects.toThrow(/stock|insufficient/i);
    });
  });
});
