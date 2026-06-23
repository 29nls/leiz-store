/**
 * JSON File-Based Database Engine
 * Provides a Prisma-compatible API using JSON files for storage
 * Zero external database dependencies - runs entirely client-side
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";

// ─── Utility Functions ────────────────────────────────────────

function cuid(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 25);
}

function matchesWhere(item: Record<string, any>, where: Record<string, any>): boolean {
  if (!where || Object.keys(where).length === 0) return true;

  return Object.entries(where).every(([key, value]) => {
    // Handle OR operator
    if (key === "OR" && Array.isArray(value)) {
      return value.some((condition: Record<string, any>) => matchesWhere(item, condition));
    }

    // Handle AND operator
    if (key === "AND" && Array.isArray(value)) {
      return value.every((condition: Record<string, any>) => matchesWhere(item, condition));
    }

    // Handle NOT operator
    if (key === "NOT" && Array.isArray(value)) {
      return !value.some((condition: Record<string, any>) => matchesWhere(item, condition));
    }

    const itemValue = item[key];

    // Handle null/undefined
    if (value === null || value === undefined) {
      return itemValue === null || itemValue === undefined;
    }

    // Handle object operators
    if (typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
      return Object.entries(value).every(([op, opValue]) => {
        const ov = opValue as any;
        switch (op) {
          case "equals":
            return itemValue === ov;
          case "not":
            if (typeof ov === "object" && ov !== null) {
              return !matchesWhere(item, { [key]: ov });
            }
            return itemValue !== ov;
          case "contains":
            return String(itemValue || "").toLowerCase().includes(String(ov).toLowerCase());
          case "startsWith":
            return String(itemValue || "").toLowerCase().startsWith(String(ov).toLowerCase());
          case "endsWith":
            return String(itemValue || "").toLowerCase().endsWith(String(ov).toLowerCase());
          case "gt":
            return itemValue > ov;
          case "gte":
            return itemValue >= ov;
          case "lt":
            return itemValue < ov;
          case "lte":
            return itemValue <= ov;
          case "in":
            return Array.isArray(ov) && ov.includes(itemValue);
          case "notIn":
            return Array.isArray(ov) && !ov.includes(itemValue);
          case "has":
            return Array.isArray(itemValue) && itemValue.includes(ov);
          case "isEmpty":
            return !itemValue || (Array.isArray(itemValue) && itemValue.length === 0);
          default:
            return true;
        }
      });
    }

    // Handle array values (in)
    if (Array.isArray(value)) {
      return value.includes(itemValue);
    }

    // Direct equality
    return itemValue === value;
  });
}

function applyOrderBy(items: Record<string, any>[], orderBy: Record<string, any> | Record<string, any>[]): Record<string, any>[] {
  const orders = Array.isArray(orderBy) ? orderBy : [orderBy];

  return [...items].sort((a, b) => {
    for (const order of orders) {
      for (const [key, direction] of Object.entries(order)) {
        const dir = direction === "asc" ? 1 : -1;
        const aVal = a[key];
        const bVal = b[key];

        if (aVal === bVal) continue;
        if (aVal === null || aVal === undefined) return 1 * dir;
        if (bVal === null || bVal === undefined) return -1 * dir;

        if (aVal instanceof Date && bVal instanceof Date) {
          return (aVal.getTime() - bVal.getTime()) * dir;
        }

        if (typeof aVal === "string" && typeof bVal === "string") {
          return aVal.localeCompare(bVal) * dir;
        }

        return (aVal - bVal) * dir;
      }
    }
    return 0;
  });
}

function applySelect(item: Record<string, any>, select: Record<string, boolean>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, include] of Object.entries(select)) {
    if (include) {
      result[key] = item[key];
    }
  }
  return result;
}

function deepMerge(target: any, source: any): any {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key]) && !(source[key] instanceof Date)) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

// ─── Relation Definitions ─────────────────────────────────────

interface RelationDef {
  model: string;
  foreignKey: string;
  type: "one" | "many";
  inverseKey?: string;
}

const RELATIONS: Record<string, Record<string, RelationDef>> = {
  store: {
    users: { model: "user", foreignKey: "storeId", type: "many" },
    products: { model: "product", foreignKey: "storeId", type: "many" },
    categories: { model: "category", foreignKey: "storeId", type: "many" },
    orders: { model: "order", foreignKey: "storeId", type: "many" },
  },
  user: {
    store: { model: "store", foreignKey: "storeId", type: "one" },
    orders: { model: "order", foreignKey: "userId", type: "many" },
    wishlist: { model: "wishlist", foreignKey: "userId", type: "many" },
    inventoryLogs: { model: "inventoryLog", foreignKey: "userId", type: "many" },
    activityLogs: { model: "activityLog", foreignKey: "userId", type: "many" },
    refreshTokens: { model: "refreshToken", foreignKey: "userId", type: "many" },
    segments: { model: "customerSegment", foreignKey: "userId", type: "many" },
  },
  refreshToken: {
    user: { model: "user", foreignKey: "userId", type: "one" },
  },
  category: {
    parent: { model: "category", foreignKey: "parentId", type: "one" },
    children: { model: "category", foreignKey: "parentId", type: "many", inverseKey: "id" },
    products: { model: "product", foreignKey: "categoryId", type: "many" },
    store: { model: "store", foreignKey: "storeId", type: "one" },
  },
  product: {
    category: { model: "category", foreignKey: "categoryId", type: "one" },
    store: { model: "store", foreignKey: "storeId", type: "one" },
    images: { model: "productImage", foreignKey: "productId", type: "many" },
    orderItems: { model: "orderItem", foreignKey: "productId", type: "many" },
    wishlist: { model: "wishlist", foreignKey: "productId", type: "many" },
    inventoryLogs: { model: "inventoryLog", foreignKey: "productId", type: "many" },
    stockAlerts: { model: "stockAlert", foreignKey: "productId", type: "many" },
  },
  productImage: {
    product: { model: "product", foreignKey: "productId", type: "one" },
  },
  order: {
    user: { model: "user", foreignKey: "userId", type: "one" },
    store: { model: "store", foreignKey: "storeId", type: "one" },
    items: { model: "orderItem", foreignKey: "orderId", type: "many" },
    payment: { model: "payment", foreignKey: "orderId", type: "one" },
  },
  orderItem: {
    order: { model: "order", foreignKey: "orderId", type: "one" },
    product: { model: "product", foreignKey: "productId", type: "one" },
  },
  payment: {
    order: { model: "order", foreignKey: "orderId", type: "one" },
  },
  analyticsEvent: {},
  salesForecast: {},
  customerSegment: {
    user: { model: "user", foreignKey: "userId", type: "one" },
  },
  productRecommendation: {
    sourceProduct: { model: "product", foreignKey: "sourceProductId", type: "one" },
    recommendedProduct: { model: "product", foreignKey: "recommendedProductId", type: "one" },
  },
  stockAlert: {
    product: { model: "product", foreignKey: "productId", type: "one" },
  },
  notification: {},
  setting: {},
  testimonial: {},
  faq: {},
  banner: {},
  activityLog: {
    user: { model: "user", foreignKey: "userId", type: "one" },
  },
  inventoryLog: {
    product: { model: "product", foreignKey: "productId", type: "one" },
    user: { model: "user", foreignKey: "userId", type: "one" },
  },
  wishlist: {
    user: { model: "user", foreignKey: "userId", type: "one" },
    product: { model: "product", foreignKey: "productId", type: "one" },
  },
  currencyRate: {},
};

// ─── JSON Model Class ─────────────────────────────────────────

class JsonModel {
  private filePath: string;
  private data: Record<string, any>[] = [];
  private modelName: string;
  private db: JsonDatabase;

  constructor(db: JsonDatabase, modelName: string) {
    this.db = db;
    this.modelName = modelName;
    this.filePath = path.join(db.dataDir, `${modelName}.json`);
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, "utf-8");
        this.data = JSON.parse(content, (key, value) => {
          // Revive Date objects
          if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
            return new Date(value);
          }
          return value;
        });
      } else {
        this.data = [];
        this.save();
      }
    } catch {
      this.data = [];
      this.save();
    }
  }

  private save(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), "utf-8");
  }

  reload(): void {
    this.load();
  }

  private resolveIncludes(items: Record<string, any>[], include?: Record<string, any>): Record<string, any>[] {
    if (!include) return items;

    const relations = RELATIONS[this.modelName] || {};

    return items.map((item) => {
      const result = { ...item };

      for (const [key, includeValue] of Object.entries(include)) {
        if (!includeValue) continue;

        const relation = relations[key];
        if (!relation) continue;

        const relatedModel = this.db.model(relation.model);
        // Always reload related model data to pick up any changes written after server start
        relatedModel.reload();
        const foreignKeyValue = item[relation.foreignKey];

        if (relation.type === "one") {
          if (foreignKeyValue === null || foreignKeyValue === undefined) {
            result[key] = null;
          } else {
            const related = relatedModel.data.find((r: Record<string, any>) => r.id === foreignKeyValue);
            result[key] = related || null;
          }
        } else if (relation.type === "many") {
          // For parent→children relations: find related items where relatedItem[foreignKey] === item.id
          // For self-referencing (category children): uses inverseKey to match item.id against relatedItem[inverseKey]
          const filterKey = relation.inverseKey || relation.foreignKey;
          // matchValue is always the current item's id (the parent's pk)
          const matchValue = item.id;

          let relatedItems = relatedModel.data.filter(
            (r: Record<string, any>) => r[filterKey] === matchValue
          );

          // Handle nested includes/selects
          if (typeof includeValue === "object" && includeValue !== true) {
            const nestedInclude = includeValue.include;
            const nestedSelect = includeValue.select;
            const nestedOrderBy = includeValue.orderBy;
            const nestedTake = includeValue.take;
            const nestedSkip = includeValue.skip;
            const nestedWhere = includeValue.where;

            if (nestedWhere) {
              relatedItems = relatedItems.filter((r: Record<string, any>) => matchesWhere(r, nestedWhere));
            }
            if (nestedOrderBy) {
              relatedItems = applyOrderBy(relatedItems, nestedOrderBy);
            }
            if (nestedSkip) {
              relatedItems = relatedItems.slice(nestedSkip);
            }
            if (nestedTake) {
              relatedItems = relatedItems.slice(0, nestedTake);
            }
            if (nestedInclude) {
              relatedItems = relatedModel.resolveIncludes(relatedItems, nestedInclude);
            }
            if (nestedSelect) {
              relatedItems = relatedItems.map((r: Record<string, any>) => applySelect(r, nestedSelect));
            }
          }

          result[key] = relatedItems;
        }
      }

      return result;
    });
  }

  private applyGroupBy(items: Record<string, any>[], by: string[]): Map<string, Record<string, any>[]> {
    const groups = new Map<string, Record<string, any>[]>();

    for (const item of items) {
      const key = by.map((field) => String(item[field])).join("|");
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(item);
    }

    return groups;
  }

  // ─── CRUD Operations ─────────────────────────────────────────

  async findMany(options: Record<string, any> = {}): Promise<Record<string, any>[]> {
    this.reload();
    let results = [...this.data];

    // Apply where
    if (options.where) {
      results = results.filter((item) => matchesWhere(item, options.where));
    }

    // Apply distinct
    if (options.distinct) {
      const seen = new Set<string>();
      results = results.filter((item) => {
        const key = options.distinct.map((f: string) => String(item[f])).join("|");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    // Apply orderBy
    if (options.orderBy) {
      results = applyOrderBy(results, options.orderBy);
    }

    // Count before pagination
    const total = results.length;

    // Apply skip/take
    if (options.skip) {
      results = results.slice(options.skip);
    }
    if (options.take) {
      results = results.slice(0, options.take);
    }

    // Apply include (relations)
    if (options.include) {
      results = this.resolveIncludes(results, options.include);
    }

    // Apply select
    if (options.select) {
      results = results.map((item) => applySelect(item, options.select));
    }

    return results;
  }

  async findUnique(options: Record<string, any>): Promise<Record<string, any> | null> {
    this.reload();

    const where = options.where;
    if (!where) return null;

    const item = this.data.find((item) => matchesWhere(item, where));
    if (!item) return null;

    let result = { ...item };

    if (options.include) {
      [result] = this.resolveIncludes([result], options.include);
    }

    if (options.select) {
      result = applySelect(result, options.select);
    }

    return result;
  }

  async findFirst(options: Record<string, any> = {}): Promise<Record<string, any> | null> {
    const results = await this.findMany({ ...options, take: 1 });
    return results[0] || null;
  }

  async create(options: Record<string, any>): Promise<Record<string, any>> {
    this.reload();

    const data = { ...options.data };

    // Auto-generate ID if not provided
    if (!data.id) {
      data.id = cuid();
    }

    // Set timestamps
    if (!data.createdAt) {
      data.createdAt = new Date();
    }
    if (!data.updatedAt) {
      data.updatedAt = new Date();
    }

    this.data.push(data);
    this.save();

    // Handle nested creates (relations)
    if (options.include) {
      const [result] = this.resolveIncludes([data], options.include);
      return result;
    }

    return data;
  }

  async createMany(options: Record<string, any>): Promise<{ count: number }> {
    this.reload();

    const items = Array.isArray(options.data) ? options.data : [options.data];
    let count = 0;

    for (const item of items) {
      const data = { ...item };
      if (!data.id) data.id = cuid();
      if (!data.createdAt) data.createdAt = new Date();
      if (!data.updatedAt) data.updatedAt = new Date();

      // Skip duplicates if requested
      if (options.skipDuplicates) {
        const exists = this.data.some((existing) => {
          return Object.entries(data).every(([key, value]) => {
            if (key === "id" || key === "createdAt" || key === "updatedAt") return true;
            return existing[key] === value;
          });
        });
        if (exists) continue;
      }

      this.data.push(data);
      count++;
    }

    this.save();
    return { count };
  }

  async update(options: Record<string, any>): Promise<Record<string, any>> {
    this.reload();

    const index = this.data.findIndex((item) => matchesWhere(item, options.where));
    if (index === -1) {
      throw new Error(`Record not found for update in ${this.modelName}`);
    }

    const data = { ...options.data };
    data.updatedAt = new Date();

    this.data[index] = deepMerge(this.data[index], data);
    this.save();

    if (options.include) {
      const [result] = this.resolveIncludes([this.data[index]], options.include);
      return result;
    }

    return this.data[index];
  }

  async updateMany(options: Record<string, any>): Promise<{ count: number }> {
    this.reload();

    let count = 0;
    const data = { ...options.data };
    data.updatedAt = new Date();

    for (let i = 0; i < this.data.length; i++) {
      if (matchesWhere(this.data[i], options.where || {})) {
        this.data[i] = deepMerge(this.data[i], data);
        count++;
      }
    }

    if (count > 0) {
      this.save();
    }

    return { count };
  }

  async upsert(options: Record<string, any>): Promise<Record<string, any>> {
    this.reload();

    const existing = this.data.find((item) => matchesWhere(item, options.where));

    if (existing) {
      const index = this.data.indexOf(existing);
      const data = { ...options.update };
      data.updatedAt = new Date();
      this.data[index] = deepMerge(this.data[index], data);
      this.save();
      return this.data[index];
    } else {
      const data = { ...options.create };
      if (!data.id) data.id = cuid();
      if (!data.createdAt) data.createdAt = new Date();
      if (!data.updatedAt) data.updatedAt = new Date();
      this.data.push(data);
      this.save();
      return data;
    }
  }

  async delete(options: Record<string, any>): Promise<Record<string, any>> {
    this.reload();

    const index = this.data.findIndex((item) => matchesWhere(item, options.where));
    if (index === -1) {
      throw new Error(`Record not found for delete in ${this.modelName}`);
    }

    const item = this.data[index];
    this.data.splice(index, 1);
    this.save();

    return item;
  }

  async deleteMany(options: Record<string, any> = {}): Promise<{ count: number }> {
    this.reload();

    const before = this.data.length;
    this.data = this.data.filter((item) => !matchesWhere(item, options.where || {}));
    const count = before - this.data.length;

    if (count > 0) {
      this.save();
    }

    return { count };
  }

  async count(options: Record<string, any> = {}): Promise<number> {
    this.reload();

    if (!options.where) return this.data.length;
    return this.data.filter((item) => matchesWhere(item, options.where)).length;
  }

  async groupBy(options: Record<string, any>): Promise<Record<string, any>[]> {
    this.reload();

    let results = [...this.data];

    if (options.where) {
      results = results.filter((item) => matchesWhere(item, options.where));
    }

    const groups = this.applyGroupBy(results, options.by);

    const groupResults: Record<string, any>[] = [];

    for (const [key, items] of groups) {
      const keyParts = key.split("|");
      const groupResult: Record<string, any> = {};

      // Set group by fields
      options.by.forEach((field: string, index: number) => {
        groupResult[field] = keyParts[index];
      });

      // Calculate aggregations
      if (options._count) {
        if (options._count === true || options._count.id) {
          groupResult._count = { id: items.length };
        } else {
          const countResult: Record<string, number> = {};
          for (const [field, value] of Object.entries(options._count)) {
            if (value) {
              countResult[field] = items.filter((item) => item[field] !== null && item[field] !== undefined).length;
            }
          }
          groupResult._count = countResult;
        }
      }

      if (options._sum) {
        const sumResult: Record<string, number> = {};
        for (const [field, value] of Object.entries(options._sum)) {
          if (value) {
            sumResult[field] = items.reduce((sum, item) => {
              const val = Number(item[field]);
              return sum + (isNaN(val) ? 0 : val);
            }, 0);
          }
        }
        groupResult._sum = sumResult;
      }

      if (options._avg) {
        const avgResult: Record<string, number> = {};
        for (const [field, value] of Object.entries(options._avg)) {
          if (value) {
            const validItems = items.filter((item) => item[field] !== null && item[field] !== undefined);
            if (validItems.length > 0) {
              avgResult[field] = validItems.reduce((sum, item) => {
                const val = Number(item[field]);
                return sum + (isNaN(val) ? 0 : val);
              }, 0) / validItems.length;
            }
          }
        }
        groupResult._avg = avgResult;
      }

      if (options._min) {
        const minResult: Record<string, any> = {};
        for (const [field, value] of Object.entries(options._min)) {
          if (value) {
            const values = items.map((item) => item[field]).filter((v) => v !== null && v !== undefined);
            minResult[field] = values.length > 0 ? values.reduce((a, b) => a < b ? a : b) : null;
          }
        }
        groupResult._min = minResult;
      }

      if (options._max) {
        const maxResult: Record<string, any> = {};
        for (const [field, value] of Object.entries(options._max)) {
          if (value) {
            const values = items.map((item) => item[field]).filter((v) => v !== null && v !== undefined);
            maxResult[field] = values.length > 0 ? values.reduce((a, b) => a > b ? a : b) : null;
          }
        }
        groupResult._max = maxResult;
      }

      groupResults.push(groupResult);
    }

    // Apply orderBy
    if (options.orderBy) {
      const orders = Array.isArray(options.orderBy) ? options.orderBy : [options.orderBy];
      groupResults.sort((a, b) => {
        for (const order of orders) {
          for (const [key, direction] of Object.entries(order)) {
            const dir = direction === "asc" ? 1 : -1;
            const aVal = a[key] ?? a._count?.[key] ?? a._sum?.[key] ?? 0;
            const bVal = b[key] ?? b._count?.[key] ?? b._sum?.[key] ?? 0;
            if (aVal !== bVal) return (aVal - bVal) * dir;
          }
        }
        return 0;
      });
    }

    // Apply take
    if (options.take) {
      return groupResults.slice(0, options.take);
    }

    return groupResults;
  }

  async aggregate(options: Record<string, any>): Promise<Record<string, any>> {
    this.reload();

    let results = [...this.data];

    if (options.where) {
      results = results.filter((item) => matchesWhere(item, options.where));
    }

    const aggregateResult: Record<string, any> = {};

    if (options._count) {
      if (options._count === true || options._count.id) {
        aggregateResult._count = { id: results.length };
      } else {
        const countResult: Record<string, number> = {};
        for (const [field, value] of Object.entries(options._count)) {
          if (value) {
            countResult[field] = results.filter((item) => item[field] !== null && item[field] !== undefined).length;
          }
        }
        aggregateResult._count = countResult;
      }
    }

    if (options._sum) {
      const sumResult: Record<string, number> = {};
      for (const [field, value] of Object.entries(options._sum)) {
        if (value) {
          sumResult[field] = results.reduce((sum, item) => {
            const val = Number(item[field]);
            return sum + (isNaN(val) ? 0 : val);
          }, 0);
        }
      }
      aggregateResult._sum = sumResult;
    }

    if (options._avg) {
      const avgResult: Record<string, number> = {};
      for (const [field, value] of Object.entries(options._avg)) {
        if (value) {
          const validItems = results.filter((item) => item[field] !== null && item[field] !== undefined);
          if (validItems.length > 0) {
            avgResult[field] = validItems.reduce((sum, item) => {
              const val = Number(item[field]);
              return sum + (isNaN(val) ? 0 : val);
            }, 0) / validItems.length;
          }
        }
      }
      aggregateResult._avg = avgResult;
    }

    if (options._min) {
      const minResult: Record<string, any> = {};
      for (const [field, value] of Object.entries(options._min)) {
        if (value) {
          const values = results.map((item) => item[field]).filter((v) => v !== null && v !== undefined);
          minResult[field] = values.length > 0 ? values.reduce((a, b) => a < b ? a : b) : null;
        }
      }
      aggregateResult._min = minResult;
    }

    if (options._max) {
      const maxResult: Record<string, any> = {};
      for (const [field, value] of Object.entries(options._max)) {
        if (value) {
          const values = results.map((item) => item[field]).filter((v) => v !== null && v !== undefined);
          maxResult[field] = values.length > 0 ? values.reduce((a, b) => a > b ? a : b) : null;
        }
      }
      aggregateResult._max = maxResult;
    }

    return aggregateResult;
  }
}

// ─── JSON Database Class ──────────────────────────────────────

class JsonDatabase {
  public dataDir: string;
  private models: Map<string, JsonModel> = new Map();

  constructor(dataDir: string) {
    this.dataDir = dataDir;

    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  model(name: string): JsonModel {
    if (!this.models.has(name)) {
      this.models.set(name, new JsonModel(this, name));
    }
    return this.models.get(name)!;
  }

  // Transaction support (simplified - sequential execution)
  async $transaction(operations: ((tx: JsonDatabase) => Promise<any>)[]): Promise<any[]> {
    const results: any[] = [];
    for (const operation of operations) {
      results.push(await operation(this));
    }
    return results;
  }

  // Raw query support (simplified)
  async $queryRaw(strings: TemplateStringsArray, ...values: any[]): Promise<any> {
    // For health check: SELECT 1
    if (strings[0]?.trim().startsWith("SELECT 1")) {
      return [{ "1": 1 }];
    }
    return [];
  }

  // Disconnect (no-op for JSON)
  async $disconnect(): Promise<void> {
    // No-op
  }
}

// ─── Create Database Instance ─────────────────────────────────

const dataDir = path.join(process.cwd(), "data");
const db = new JsonDatabase(dataDir);

// Export model accessors matching Prisma's API
export const prisma = {
  // Models
  store: db.model("store"),
  user: db.model("user"),
  refreshToken: db.model("refreshToken"),
  category: db.model("category"),
  product: db.model("product"),
  productImage: db.model("productImage"),
  order: db.model("order"),
  orderItem: db.model("orderItem"),
  payment: db.model("payment"),
  analyticsEvent: db.model("analyticsEvent"),
  salesForecast: db.model("salesForecast"),
  customerSegment: db.model("customerSegment"),
  productRecommendation: db.model("productRecommendation"),
  stockAlert: db.model("stockAlert"),
  notification: db.model("notification"),
  setting: db.model("setting"),
  testimonial: db.model("testimonial"),
  faq: db.model("faq"),
  banner: db.model("banner"),
  activityLog: db.model("activityLog"),
  inventoryLog: db.model("inventoryLog"),
  wishlist: db.model("wishlist"),
  currencyRate: db.model("currencyRate"),

  // Transaction support - supports both array and single function patterns
  async $transaction(operations: ((tx: any) => Promise<any>)[] | ((tx: any) => Promise<any>)): Promise<any> {
    if (typeof operations === 'function') {
      return operations(prisma);
    }
    return db.$transaction(operations);
  },

  // Raw query support
  async $queryRaw(strings: TemplateStringsArray, ...values: any[]): Promise<any> {
    return db.$queryRaw(strings, ...values);
  },

  // Disconnect
  async $disconnect(): Promise<void> {
    return db.$disconnect();
  },
};

export { JsonDatabase, JsonModel };
export default prisma;
