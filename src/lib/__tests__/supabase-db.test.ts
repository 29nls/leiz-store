/**
 * Tests for Supabase Database Adapter (supabase-db.ts)
 * Tests utility functions and SupabaseModel methods with mocked Supabase client
 */
import {
  prisma,
  SupabaseModel,
  toSnake,
  toCamel,
  buildSelectString,
  buildFilters,
  applySimpleFilter,
  findRelation,
  findModelName,
  CAMEL_TO_SNAKE,
  SNAKE_TO_CAMEL,
  RELATIONS,
  MODEL_TO_TABLE,
} from "@/lib/supabase-db";

// ─── Mock Supabase Client ─────────────────────────────────────
// Use var for hoisting: jest.mock is hoisted above all imports, so any
// variable referenced inside the factory must use var (not let/const).

type ResolveValue = { data: any; error: any; count?: number };

var mockQueryBuilder: any;
var mockSupabaseClient: any;
var mockResolveValue: ResolveValue = { data: [], error: null };

jest.mock("@/lib/supabase", () => ({
  get supabaseAdmin() { return mockSupabaseClient; },
}));

function createQueryBuilder() {
  const qb: any = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    not: { in: jest.fn().mockReturnThis() },
    or: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    rpc: jest.fn(),
    then: jest.fn(function (this: any, resolve: any) {
      resolve(mockResolveValue);
    }),
  };
  return qb;
}

function setMockData(data: any, count?: number) {
  mockResolveValue = { data, error: null, count };
}

function setMockError(error: Error) {
  mockResolveValue = { data: null, error };
}

beforeAll(() => {
  mockQueryBuilder = createQueryBuilder();
  mockSupabaseClient = {
    from: jest.fn().mockReturnValue(mockQueryBuilder),
    rpc: jest.fn(),
  };
});

beforeEach(() => {
  Object.assign(mockQueryBuilder, createQueryBuilder());
  mockSupabaseClient.from.mockReturnValue(mockQueryBuilder);
  mockSupabaseClient.rpc.mockReset();
  mockResolveValue = { data: [], error: null };
});

// ─── toSnake / toCamel ───────────────────────────────────────

describe("toSnake / toCamel conversion", () => {
  it("toSnake converts camelCase keys to snake_case", () => {
    const result = toSnake({
      userId: "abc",
      isActive: true,
      storeId: null,
      createdAt: new Date("2024-01-01"),
    });
    expect(result).toEqual({
      user_id: "abc",
      is_active: true,
      store_id: null,
      created_at: "2024-01-01T00:00:00.000Z",
    });
  });

  it("toSnake passes through unknown keys unchanged", () => {
    const result = toSnake({ someUnknownKey: "val" } as any);
    expect(result).toEqual({ someUnknownKey: "val" });
  });

  it("toSnake skips undefined values", () => {
    const result = toSnake({ userId: "abc", storeId: undefined } as any);
    expect(result).toEqual({ user_id: "abc" });
  });

  it("toCamel converts snake_case keys to camelCase", () => {
    const result = toCamel({
      user_id: "abc",
      is_active: true,
      created_at: "2024-01-01T00:00:00.000Z",
    });
    expect(result).toEqual({
      userId: "abc",
      isActive: true,
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
    });
  });

  it("toCamel converts unknown snake_case keys generically", () => {
    const result = toCamel({ some_unknown_key: "val" });
    expect(result).toEqual({ someUnknownKey: "val" });
  });

  it("toCamel converts nested objects recursively", () => {
    const result = toCamel({
      user_profile: { first_name: "John", last_name: "Doe" },
    });
    expect(result).toEqual({
      userProfile: { firstName: "John", lastName: "Doe" },
    });
  });

  it("toCamel handles arrays", () => {
    const result = toCamel([{ user_id: "1" }, { user_id: "2" }]);
    expect(result).toEqual([{ userId: "1" }, { userId: "2" }]);
  });

  it("CAMEL_TO_SNAKE has symmetric reverse mapping", () => {
    for (const [camel, snake] of Object.entries(CAMEL_TO_SNAKE)) {
      expect(SNAKE_TO_CAMEL[snake]).toBe(camel);
    }
  });
});

// ─── buildFilters / applySimpleFilter ────────────────────────

describe("buildFilters", () => {
  let qb: any;

  beforeEach(() => {
    qb = createQueryBuilder();
  });

  it("returns query unchanged when where is undefined", () => {
    const result = buildFilters(qb, undefined);
    expect(result).toBe(qb);
  });

  it("applies simple equality filter", () => {
    buildFilters(qb, { isActive: true });
    expect(qb.eq).toHaveBeenCalledWith("is_active", true);
  });

  it("applies null filter with .is", () => {
    buildFilters(qb, { storeId: null });
    expect(qb.is).toHaveBeenCalledWith("store_id", null);
  });

  it("applies nested operator filters (gt, lt, gte, lte)", () => {
    buildFilters(qb, { price: { gt: 100, lte: 500 } });
    expect(qb.gt).toHaveBeenCalledWith("price", 100);
    expect(qb.lte).toHaveBeenCalledWith("price", 500);
  });

  it("applies contains filter with ilike", () => {
    buildFilters(qb, { name: { contains: "dragon" } });
    expect(qb.ilike).toHaveBeenCalledWith("name", "%dragon%");
  });

  it("applies startsWith filter with ilike", () => {
    buildFilters(qb, { name: { startsWith: "Dragon" } });
    expect(qb.ilike).toHaveBeenCalledWith("name", "Dragon%");
  });

  it("applies endsWith filter with ilike", () => {
    buildFilters(qb, { name: { endsWith: "Nest" } });
    expect(qb.ilike).toHaveBeenCalledWith("name", "%Nest");
  });

  it("applies in filter with array value", () => {
    buildFilters(qb, { category_id: ["c1", "c2"] });
    expect(qb.in).toHaveBeenCalledWith("category_id", ["c1", "c2"]);
  });

  it("applies notIn filter", () => {
    buildFilters(qb, { status: { notIn: ["CANCELLED", "REFUNDED"] } });
    expect(qb.not.in).toHaveBeenCalledWith("status", ["CANCELLED", "REFUNDED"]);
  });

  it("applies equals filter", () => {
    buildFilters(qb, { slug: { equals: "test-product" } });
    expect(qb.eq).toHaveBeenCalledWith("slug", "test-product");
  });

  it("applies not (neq) filter", () => {
    buildFilters(qb, { status: { not: "DRAFT" } });
    expect(qb.neq).toHaveBeenCalledWith("status", "DRAFT");
  });

  it("skips reserved keys OR, AND, NOT", () => {
    buildFilters(qb, { OR: [], AND: [], NOT: {} });
    // OR with empty array is not called; AND/NOT are skipped entirely
    expect(qb.or).not.toHaveBeenCalled();
    expect(qb.eq).not.toHaveBeenCalled();
  });

  it("handles OR conditions", () => {
    buildFilters(qb, {
      OR: [
        { name: "Test" },
        { name: "Other" },
      ],
    });
    expect(qb.or).toHaveBeenCalled();
    const orArg = qb.or.mock.calls[0][0] as string;
    expect(orArg).toContain("and(");
    expect(orArg).toContain("name.eq.Test");
    expect(orArg).toContain("name.eq.Other");
  });

  it("handles OR with contains operator", () => {
    buildFilters(qb, {
      OR: [
        { name: { contains: "dragon" } },
      ],
    });
    const orArg = qb.or.mock.calls[0][0] as string;
    expect(orArg).toContain("name.ilike.%dragon%");
  });

  it("handles multiple where keys", () => {
    buildFilters(qb, { isActive: true, slug: "test" });
    expect(qb.eq).toHaveBeenCalledWith("is_active", true);
    expect(qb.eq).toHaveBeenCalledWith("slug", "test");
  });

  it("skips OR when array is empty", () => {
    buildFilters(qb, { OR: [], isActive: true });
    expect(qb.or).not.toHaveBeenCalled();
    expect(qb.eq).toHaveBeenCalledWith("is_active", true);
  });
});

describe("applySimpleFilter", () => {
  let qb: any;

  beforeEach(() => {
    qb = createQueryBuilder();
  });

  it("calls .is for null values", () => {
    applySimpleFilter(qb, "store_id", null);
    expect(qb.is).toHaveBeenCalledWith("store_id", null);
  });

  it("calls .is for undefined values", () => {
    applySimpleFilter(qb, "store_id", undefined);
    // The adapter normalizes undefined to null via the null check
    expect(qb.is).toHaveBeenCalledWith("store_id", null);
  });

  it("calls .in for array values", () => {
    applySimpleFilter(qb, "status", ["A", "B"]);
    expect(qb.in).toHaveBeenCalledWith("status", ["A", "B"]);
  });

  it("calls .eq for plain values", () => {
    applySimpleFilter(qb, "slug", "test");
    expect(qb.eq).toHaveBeenCalledWith("slug", "test");
  });

  it("calls .gte for gte operator", () => {
    applySimpleFilter(qb, "price", { gte: 100 });
    expect(qb.gte).toHaveBeenCalledWith("price", 100);
  });

  it("calls .lt for lt operator", () => {
    applySimpleFilter(qb, "price", { lt: 500 });
    expect(qb.lt).toHaveBeenCalledWith("price", 500);
  });
});

// ─── buildSelectString ───────────────────────────────────────

describe("buildSelectString", () => {
  it("returns * when no select or include", () => {
    const result = buildSelectString("product");
    expect(result.selectString).toBe("*");
    expect(result.hasCountSelect).toBe(false);
  });

  it("maps select keys to snake_case", () => {
    const result = buildSelectString("product", undefined, {
      id: true,
      name: true,
      isActive: true,
    });
    expect(result.selectString).toBe("id,name,is_active");
  });

  it("handles _count in select", () => {
    const result = buildSelectString("category", undefined, {
      id: true,
      name: true,
      _count: { select: { products: true } },
    } as any);
    expect(result.selectString).toBe("id,name");
    expect(result.hasCountSelect).toBe(true);
    expect(result.countSelectRelations).toEqual({ products: true });
  });

  it("handles _count in include", () => {
    const result = buildSelectString("category", {
      _count: { select: { products: true } },
    } as any);
    expect(result.selectString).toBe("*");
    expect(result.hasCountSelect).toBe(true);
    expect(result.countSelectRelations).toEqual({ products: true });
  });

  it("handles empty select", () => {
    const result = buildSelectString("product", undefined, {});
    expect(result.selectString).toBe("id");
  });
});

// ─── findRelation ─────────────────────────────────────────────

describe("findRelation", () => {
  it("finds relation for known model and key", () => {
    const rel = findRelation("product", "category");
    expect(rel).toBeTruthy();
    expect(rel!.table).toBe("category");
    expect(rel!.foreignKey).toBe("category_id");
    expect(rel!.type).toBe("one");
  });

  it("finds many relation", () => {
    const rel = findRelation("product", "images");
    expect(rel).toBeTruthy();
    expect(rel!.table).toBe("product_image");
    expect(rel!.type).toBe("many");
  });

  it("returns null for unknown model", () => {
    expect(findRelation("nonexistent" as any, "anything")).toBeNull();
  });

  it("returns null for unknown relation key", () => {
    expect(findRelation("product", "nonexistent")).toBeNull();
  });

  it("returns null for model without relations", () => {
    expect(findRelation("setting", "anything")).toBeNull();
  });
});

// ─── findModelName ────────────────────────────────────────────

describe("findModelName", () => {
  it("maps table name to model name", () => {
    expect(findModelName("product")).toBe("product");
    expect(findModelName("product_image")).toBe("productImage");
    expect(findModelName("order_item")).toBe("orderItem");
    expect(findModelName("analytics_event")).toBe("analyticsEvent");
  });

  it("returns null for unknown table", () => {
    expect(findModelName("nonexistent_table")).toBeNull();
  });

  it("MODEL_TO_TABLE has all 23 models", () => {
    expect(Object.keys(MODEL_TO_TABLE)).toHaveLength(23);
  });
});

// ─── SupabaseModel CRUD ───────────────────────────────────────

describe("SupabaseModel", () => {
  let model: SupabaseModel;

  beforeEach(() => {
    model = new SupabaseModel(mockSupabaseClient as any, "product");
    Object.assign(mockQueryBuilder, createQueryBuilder());
    mockSupabaseClient.from.mockReturnValue(mockQueryBuilder);
    mockResolveValue = { data: [], error: null };
  });

  describe("findMany", () => {
    it("basic query with no options", async () => {
      setMockData([{ id: "1", name: "Test", category_id: "c1" }]);

      const result = await model.findMany();

      expect(mockSupabaseClient.from).toHaveBeenCalledWith("product");
      expect(mockQueryBuilder.select).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Test");
    });

    it("applies where filters", async () => {
      setMockData([{ id: "1" }]);
      await model.findMany({ where: { isActive: true } });
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith("is_active", true);
    });

    it("applies orderBy", async () => {
      setMockData([{ id: "1" }, { id: "2" }]);
      await model.findMany({ orderBy: { createdAt: "desc" } });
      expect(mockQueryBuilder.order).toHaveBeenCalledWith("created_at", {
        ascending: false,
      });
    });

    it("applies skip and take", async () => {
      setMockData([{ id: "3" }]);
      await model.findMany({ skip: 2, take: 1 });
      expect(mockQueryBuilder.range).toHaveBeenCalledWith(2, 2);
    });

    it("throws on error", async () => {
      setMockError(new Error("DB error"));
      await expect(model.findMany()).rejects.toThrow("DB error");
    });

    it("handles contains filter", async () => {
      setMockData([{ id: "1" }]);
      await model.findMany({ where: { name: { contains: "test" } } });
      expect(mockQueryBuilder.ilike).toHaveBeenCalledWith("name", "%test%");
    });

    it("handles _count in include", async () => {
      // Main query returns 1 item, then count query returns 5
      const calls: Array<{ data: any; count?: number }> = [
        { data: [{ id: "1" }] },  // findMany select
        { data: null, count: 5 },  // resolveIncludeCounts
      ];
      let callIdx = 0;
      mockQueryBuilder.then.mockImplementation((resolve: any) => {
        resolve(calls[callIdx++ % calls.length]);
      });

      const result = await model.findMany({
        include: { _count: { select: { images: true } } },
      });

      expect(mockSupabaseClient.from).toHaveBeenCalledWith("product_image");
      expect(result[0]._count.images).toBe(5);
    });
  });

  describe("findUnique", () => {
    it("returns null for empty where", async () => {
      const result = await model.findUnique({ where: null as any });
      expect(result).toBeNull();
    });

    it("finds by slug", async () => {
      setMockData([{ id: "1", slug: "test-product" }]);
      const result = await model.findUnique({ where: { slug: "test-product" } });
      expect(result).not.toBeNull();
      expect(result!.slug).toBe("test-product");
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith("slug", "test-product");
    });

    it("returns null when not found", async () => {
      setMockData([]);
      const result = await model.findUnique({ where: { slug: "nonexistent" } });
      expect(result).toBeNull();
    });
  });

  describe("findFirst", () => {
    it("returns first result", async () => {
      setMockData([{ id: "1" }]);
      const result = await model.findFirst({ where: { isActive: true } });
      expect(result).not.toBeNull();
      expect(result!.id).toBe("1");
      expect(mockQueryBuilder.range).toHaveBeenCalledWith(0, 0);
    });

    it("returns null when empty", async () => {
      setMockData([]);
      const result = await model.findFirst();
      expect(result).toBeNull();
    });
  });

  describe("createMany", () => {
    it("creates multiple records", async () => {
      mockQueryBuilder.then.mockImplementation((resolve: any) => {
        resolve({ data: null, error: null, count: 2 });
      });

      const result = await model.createMany({
        data: [
          { name: "Item 1", price: 10 },
          { name: "Item 2", price: 20 },
        ],
      });

      expect(mockQueryBuilder.insert).toHaveBeenCalled();
      expect(result.count).toBe(2);
    });

    it("auto-generates IDs when not provided", async () => {
      mockQueryBuilder.then.mockImplementation((resolve: any) => {
        resolve({ data: null, error: null, count: 1 });
      });

      await model.createMany({ data: [{ name: "Single" }] });

      const insertArg = mockQueryBuilder.insert.mock.calls[0][0];
      expect(insertArg[0].id).toBeDefined();
      expect(insertArg[0].id.length).toBe(25);
    });

    it("throws on error", async () => {
      setMockError(new Error("Insert failed"));
      await expect(
        model.createMany({ data: [{ name: "Fail" }] })
      ).rejects.toThrow("Insert failed");
    });
  });

  describe("updateMany", () => {
    it("updates multiple records", async () => {
      mockQueryBuilder.then.mockImplementation((resolve: any) => {
        resolve({ data: null, error: null, count: 3 });
      });

      const result = await model.updateMany({
        where: { isActive: false },
        data: { isActive: true },
      });

      expect(mockQueryBuilder.update).toHaveBeenCalled();
      expect(result.count).toBe(3);
    });

    it("returns 0 when data is empty/null", async () => {
      const result = await model.updateMany({ data: null });
      expect(result.count).toBe(0);
    });

    it("throws on error", async () => {
      setMockError(new Error("Update failed"));
      await expect(
        model.updateMany({ where: { id: "1" }, data: { name: "X" } })
      ).rejects.toThrow("Update failed");
    });
  });

  describe("deleteMany", () => {
    it("deletes multiple records", async () => {
      mockQueryBuilder.then.mockImplementation((resolve: any) => {
        resolve({ data: null, error: null, count: 5 });
      });

      const result = await model.deleteMany({ where: { isActive: false } });
      expect(mockQueryBuilder.delete).toHaveBeenCalled();
      expect(result.count).toBe(5);
    });

    it("deletes all when no where clause", async () => {
      mockQueryBuilder.then.mockImplementation((resolve: any) => {
        resolve({ data: null, error: null, count: 10 });
      });

      const result = await model.deleteMany();
      expect(result.count).toBe(10);
    });

    it("throws on error", async () => {
      setMockError(new Error("Delete failed"));
      await expect(model.deleteMany({ where: { id: "1" } })).rejects.toThrow("Delete failed");
    });
  });

  describe("create", () => {
    it("creates a record with timestamps", async () => {
      const now = new Date("2024-01-01T00:00:00.000Z");
      jest.useFakeTimers().setSystemTime(now);

      setMockData({
        id: "new-1",
        name: "New Product",
        slug: "new-product",
        price: 100,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      });

      const result = await model.create({
        data: { name: "New Product", slug: "new-product", price: 100 },
      });

      expect(mockSupabaseClient.from).toHaveBeenCalledWith("product");
      expect(result.name).toBe("New Product");
      expect(result.createdAt).toBeInstanceOf(Date);
      jest.useRealTimers();
    });

    it("throws on error", async () => {
      setMockError(new Error("Unique constraint violation"));
      await expect(model.create({ data: { name: "Duplicate" } })).rejects.toThrow(
        "Unique constraint violation"
      );
    });
  });

  describe("update", () => {
    it("updates and returns the record", async () => {
      setMockData({ id: "1", name: "Updated", updated_at: "2024-01-01T00:00:00.000Z" });

      const result = await model.update({
        where: { id: "1" },
        data: { name: "Updated" },
      });

      expect(result.name).toBe("Updated");
    });

    it("throws without where", async () => {
      await expect((model as any).update({ data: { name: "test" } })).rejects.toThrow(
        "where is required for update"
      );
    });
  });

  describe("upsert", () => {
    it("updates when record exists", async () => {
      const calls: Array<{ data: any; error: any }> = [
        { data: [{ id: "1" }], error: null },  // findFirst
        { data: { id: "1", key: "test", value: "updated" }, error: null },  // update
      ];
      let callIdx = 0;
      mockQueryBuilder.then.mockImplementation((resolve: any) => {
        resolve(calls[callIdx++ % calls.length]);
      });

      const result = await model.upsert({
        where: { id: "1" },
        update: { value: "updated" },
        create: { id: "1", key: "test", value: "new" },
      });

      expect(result.id).toBe("1");
      expect(mockQueryBuilder.update).toHaveBeenCalled();
    });

    it("creates when record does not exist", async () => {
      const calls: Array<{ data: any; error: any }> = [
        { data: [], error: null },  // findFirst - empty
        { data: { id: "new-1", key: "test", value: "new" }, error: null },  // create
      ];
      let callIdx = 0;
      mockQueryBuilder.then.mockImplementation((resolve: any) => {
        resolve(calls[callIdx++ % calls.length]);
      });

      const result = await model.upsert({
        where: { id: "new-1" },
        update: { value: "updated" },
        create: { id: "new-1", key: "test", value: "new" },
      });

      expect(result.id).toBe("new-1");
      expect(mockQueryBuilder.insert).toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("deletes record", async () => {
      setMockData({ id: "1" });
      const result = await model.delete({ where: { id: "1" } });
      expect(result.id).toBe("1");
    });

    it("throws without where", async () => {
      await expect(model.delete({} as any)).rejects.toThrow("where is required for delete");
    });
  });

  describe("count", () => {
    it("returns count", async () => {
      mockResolveValue = { data: null, error: null, count: 42 };
      const result = await model.count();
      expect(result).toBe(42);
    });

    it("returns 0 on null count", async () => {
      mockResolveValue = { data: null, error: null, count: null as any };
      const result = await model.count();
      expect(result).toBe(0);
    });
  });

  describe("aggregate", () => {
    it("returns _count and _sum", async () => {
      setMockData([
        { id: "1", price: 100, total: 200 },
        { id: "2", price: 150, total: 300 },
        { id: "3", price: null, total: 0 },
      ]);

      const result = await model.aggregate({
        _count: { id: true },
        _sum: { price: true, total: true },
      });

      expect(result._count).toEqual({ id: 3 });
      expect(result._sum).toEqual({ price: 250, total: 500 });
    });

    it("returns _avg, _min, _max", async () => {
      setMockData([
        { id: "1", price: 100 },
        { id: "2", price: 200 },
        { id: "3", price: 300 },
      ]);

      const result = await model.aggregate({
        _avg: { price: true },
        _min: { price: true },
        _max: { price: true },
      });

      expect(result._avg).toEqual({ price: 200 });
      expect(result._min).toEqual({ price: 100 });
      expect(result._max).toEqual({ price: 300 });
    });
  });

  describe("groupBy", () => {
    it("groups by field with _count and _sum", async () => {
      setMockData([
        { id: "1", payment_method: "qris", total: 100 },
        { id: "2", payment_method: "qris", total: 200 },
        { id: "3", payment_method: "bank", total: 300 },
      ]);

      const result = await model.groupBy({
        by: ["paymentMethod"],
        _count: { id: true },
        _sum: { total: true },
      });

      expect(result).toHaveLength(2);
      const qris = result.find((r: any) => r.paymentMethod === "qris");
      expect(qris).toBeDefined();
      expect(qris!._count.id).toBe(2);
      expect(qris!._sum.total).toBe(300);

      const bank = result.find((r: any) => r.paymentMethod === "bank");
      expect(bank).toBeDefined();
      expect(bank!._count.id).toBe(1);
      expect(bank!._sum.total).toBe(300);
    });
  });
});

// ─── prisma exports ──────────────────────────────────────────

describe("prisma instance", () => {
  it("has all 23 model accessors", () => {
    const models: Array<keyof typeof prisma> = [
      "store", "user", "refreshToken", "category", "product", "productImage",
      "order", "orderItem", "payment", "analyticsEvent", "salesForecast",
      "customerSegment", "productRecommendation", "stockAlert", "notification",
      "setting", "testimonial", "faq", "banner", "activityLog", "inventoryLog",
      "wishlist", "currencyRate",
    ];
    for (const m of models) {
      expect(prisma[m]).toBeInstanceOf(SupabaseModel);
    }
  });

  it("has $transaction, $queryRaw, $disconnect methods", () => {
    expect(typeof prisma.$transaction).toBe("function");
    expect(typeof prisma.$queryRaw).toBe("function");
    expect(typeof prisma.$disconnect).toBe("function");
  });
});

describe("$transaction", () => {
  it("executes callback with prisma", async () => {
    const callback = jest.fn().mockResolvedValue("result");
    const result = await prisma.$transaction(callback);
    expect(callback).toHaveBeenCalledWith(prisma);
    expect(result).toBe("result");
  });

  it("executes array of operations sequentially", async () => {
    const order = jest.fn().mockResolvedValue("order");
    const log = jest.fn().mockResolvedValue("log");
    const results = await prisma.$transaction([order, log]);
    expect(results).toEqual(["order", "log"]);
  });
});

describe("$queryRaw", () => {
  it("handles SELECT 1 for health check", async () => {
    const result = await prisma.$queryRaw`SELECT 1`;
    expect(result).toEqual([{ "1": 1 }]);
  });

  it("handles string argument for SELECT 1", async () => {
    const result = await prisma.$queryRaw("SELECT 1");
    expect(result).toEqual([{ "1": 1 }]);
  });

  it("falls back to empty array on error", async () => {
    mockSupabaseClient.rpc.mockRejectedValue(new Error("RPC not found"));
    const result = await prisma.$queryRaw`SELECT * FROM products`;
    expect(result).toEqual([]);
  });
});
