/**
 * Supabase Database Adapter
 * Drop-in replacement for json-db.ts using Supabase REST API
 * Provides a Prisma-compatible API so all repositories/services work unchanged
 */

import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Column Name Mapping (camelCase ↔ snake_case) ───────────

const CAMEL_TO_SNAKE: Record<string, string> = {
  publicId: "public_id",
  isActive: "is_active",
  isFeatured: "is_featured",
  isRead: "is_read",
  isSent: "is_sent",
  sortOrder: "sort_order",
  minStock: "min_stock",
  comparePrice: "compare_price",
  comparePriceUSD: "compare_price_usd",
  priceUSD: "price_usd",
  subtotalUSD: "subtotal_usd",
  taxUSD: "tax_usd",
  discountUSD: "discount_usd",
  totalUSD: "total_usd",
  amountUSD: "amount_usd",
  parentId: "parent_id",
  storeId: "store_id",
  userId: "user_id",
  productId: "product_id",
  orderId: "order_id",
  categoryId: "category_id",
  sourceProductId: "source_product_id",
  recommendedProductId: "recommended_product_id",
  orderNumber: "order_number",
  paymentMethod: "payment_method",
  paymentProof: "payment_proof",
  paymentRef: "payment_ref",
  customerName: "customer_name",
  customerEmail: "customer_email",
  customerDiscord: "customer_discord",
  customerIGN: "customer_ign",
  customerNotes: "customer_notes",
  accountNumber: "account_number",
  accountName: "account_name",
  ipAddress: "ip_address",
  userAgent: "user_agent",
  groupName: "group_name",
  lifetimeValue: "lifetime_value",
  recencyDays: "recency_days",
  rfmScore: "rfm_score",
  lastCalculated: "last_calculated",
  predictedValue: "predicted_value",
  actualValue: "actual_value",
  currentStock: "current_stock",
  sentVia: "sent_via",
  previousStock: "previous_stock",
  newStock: "new_stock",
  lastLoginAt: "last_login_at",
  completedAt: "completed_at",
  paidAt: "paid_at",
  verifiedAt: "verified_at",
  sentAt: "sent_at",
  createdAt: "created_at",
  updatedAt: "updated_at",
  fromCurrency: "from_currency",
  toCurrency: "to_currency",
  entityId: "entity_id",
  change: "change_amount",
  buyerDiscordId: "buyer_discord_id",
  expiryAt: "expiry_at",
  confirmedAt: "confirmed_at",
  cancelledAt: "cancelled_at",
  actorType: "actor_type",
  actorId: "actor_id",
  previousStatus: "previous_status",
  newStatus: "new_status",
  buyerName: "buyer_name",
};

const SNAKE_TO_CAMEL: Record<string, string> = {};
for (const [camel, snake] of Object.entries(CAMEL_TO_SNAKE)) {
  SNAKE_TO_CAMEL[snake] = camel;
}

function toSnake(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = CAMEL_TO_SNAKE[key] || key;
    if (value instanceof Date) {
      result[snakeKey] = value.toISOString();
    } else if (value !== undefined) {
      result[snakeKey] = value;
    }
  }
  return result;
}

// Models that have an updated_at column in the database
const MODELS_WITH_UPDATED_AT = new Set([
  "store", "user", "category", "product", "order", "payment", "currency_rate",
]);

function snakeToCamelFallback(key: string): string {
  return key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

function toCamel(obj: Record<string, any>): Record<string, any> {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(toCamel);

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = SNAKE_TO_CAMEL[key] || snakeToCamelFallback(key);
    // Convert ISO date strings to Date objects
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
      result[camelKey] = new Date(value);
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      result[camelKey] = toCamel(value);
    } else {
      result[camelKey] = value;
    }
  }
  return result;
}

// ─── Table name mapping ──────────────────────────────────────

const MODEL_TO_TABLE: Record<string, string> = {
  store: "store",
  user: "user",
  refreshToken: "refresh_token",
  category: "category",
  product: "product",
  productImage: "product_image",
  order: "order",
  orderItem: "order_item",
  payment: "payment",
  analyticsEvent: "analytics_event",
  salesForecast: "sales_forecast",
  customerSegment: "customer_segment",
  productRecommendation: "product_recommendation",
  stockAlert: "stock_alert",
  notification: "notification",
  setting: "setting",
  testimonial: "testimonial",
  faq: "faq",
  banner: "banner",
  activityLog: "activity_log",
  inventoryLog: "inventory_log",
  wishlist: "wishlist",
  currencyRate: "currency_rate",
  paymentConfirmation: "payment_confirmation",
  orderLog: "order_log",
};

// ─── Relation/Include definitions ────────────────────────────

interface RelationDef {
  table: string;
  foreignKey: string;
  type: "one" | "many";
  inverseKey?: string;
}

const RELATIONS: Record<string, Record<string, RelationDef>> = {
  store: {
    users: { table: "user", foreignKey: "store_id", type: "many" },
    products: { table: "product", foreignKey: "store_id", type: "many" },
    categories: { table: "category", foreignKey: "store_id", type: "many" },
    orders: { table: "order", foreignKey: "store_id", type: "many" },
  },
  user: {
    store: { table: "store", foreignKey: "store_id", type: "one" },
    orders: { table: "order", foreignKey: "user_id", type: "many" },
    wishlist: { table: "wishlist", foreignKey: "user_id", type: "many" },
    inventoryLogs: { table: "inventory_log", foreignKey: "user_id", type: "many" },
    activityLogs: { table: "activity_log", foreignKey: "user_id", type: "many" },
    refreshTokens: { table: "refresh_token", foreignKey: "user_id", type: "many" },
    segments: { table: "customer_segment", foreignKey: "user_id", type: "many" },
  },
  category: {
    parent: { table: "category", foreignKey: "parent_id", type: "one" },
    children: { table: "category", foreignKey: "parent_id", type: "many" },
    products: { table: "product", foreignKey: "category_id", type: "many" },
    store: { table: "store", foreignKey: "store_id", type: "one" },
  },
  product: {
    category: { table: "category", foreignKey: "category_id", type: "one" },
    store: { table: "store", foreignKey: "store_id", type: "one" },
    images: { table: "product_image", foreignKey: "product_id", type: "many" },
    orderItems: { table: "order_item", foreignKey: "product_id", type: "many" },
    wishlist: { table: "wishlist", foreignKey: "product_id", type: "many" },
    inventoryLogs: { table: "inventory_log", foreignKey: "product_id", type: "many" },
    stockAlerts: { table: "stock_alert", foreignKey: "product_id", type: "many" },
  },
  productImage: {
    product: { table: "product", foreignKey: "product_id", type: "one" },
  },
  order: {
    user: { table: "user", foreignKey: "user_id", type: "one" },
    store: { table: "store", foreignKey: "store_id", type: "one" },
    items: { table: "order_item", foreignKey: "order_id", type: "many" },
    payment: { table: "payment", foreignKey: "order_id", type: "one" },
  },
  orderItem: {
    order: { table: "order", foreignKey: "order_id", type: "one" },
    product: { table: "product", foreignKey: "product_id", type: "one" },
  },
  payment: {
    order: { table: "order", foreignKey: "order_id", type: "one" },
  },
  activityLog: {
    user: { table: "user", foreignKey: "user_id", type: "one" },
  },
  inventoryLog: {
    product: { table: "product", foreignKey: "product_id", type: "one" },
    user: { table: "user", foreignKey: "user_id", type: "one" },
  },
  wishlist: {
    user: { table: "user", foreignKey: "user_id", type: "one" },
    product: { table: "product", foreignKey: "product_id", type: "one" },
  },
  productRecommendation: {
    sourceProduct: { table: "product", foreignKey: "source_product_id", type: "one" },
    recommendedProduct: { table: "product", foreignKey: "recommended_product_id", type: "one" },
  },
  customerSegment: {
    user: { table: "user", foreignKey: "user_id", type: "one" },
  },
  stockAlert: {
    product: { table: "product", foreignKey: "product_id", type: "one" },
  },
  notification: {},
  setting: {},
  testimonial: {},
  faq: {},
  banner: {},
  analyticsEvent: {},
  salesForecast: {},
  currencyRate: {},
  paymentConfirmation: {
    order: { table: "order", foreignKey: "order_id", type: "one" },
  },
  orderLog: {
    order: { table: "order", foreignKey: "order_id", type: "one" },
  },
};

// ─── Where clause builder ────────────────────────────────────

function buildFilters(query: any, where?: Record<string, any>): any {
  if (!where) return query;

  // Handle OR operator
  if (where.OR && Array.isArray(where.OR)) {
    const orParts: string[] = [];
    for (const condition of where.OR) {
      const filters: string[] = [];
      for (const [key, value] of Object.entries(condition)) {
        const snakeKey = CAMEL_TO_SNAKE[key] || key;
        if (value && typeof value === "object" && !Array.isArray(value)) {
          for (const [op, opValue] of Object.entries(value)) {
            if (op === "contains") {
              filters.push(`${snakeKey}.ilike.%${encodeURIComponent(String(opValue))}%`);
            } else {
              filters.push(`${snakeKey}.${op}.${encodeURIComponent(String(opValue))}`);
            }
          }
        } else {
          filters.push(`${snakeKey}.eq.${encodeURIComponent(String(value))}`);
        }
      }
      orParts.push(`and(${filters.join(",")})`);
    }
    if (orParts.length > 0) {
      query = query.or(orParts.join(","));
    }
  }

  for (const [key, value] of Object.entries(where)) {
    if (key === "OR" || key === "AND" || key === "NOT") continue;
    const snakeKey = CAMEL_TO_SNAKE[key] || key;
    applySimpleFilter(query, snakeKey, value);
  }

  return query;
}

function applySimpleFilter(query: any, snakeKey: string, value: any): void {
  if (value === null || value === undefined) {
    query.is(snakeKey, null);
  } else if (typeof value === "object" && !Array.isArray(value)) {
    for (const [op, opValue] of Object.entries(value)) {
      switch (op) {
        case "equals": query.eq(snakeKey, opValue); break;
        case "not": query.neq(snakeKey, opValue); break;
        case "contains": query.ilike(snakeKey, `%${opValue}%`); break;
        case "startsWith": query.ilike(snakeKey, `${opValue}%`); break;
        case "endsWith": query.ilike(snakeKey, `%${opValue}`); break;
        case "gt": query.gt(snakeKey, opValue); break;
        case "gte": query.gte(snakeKey, opValue); break;
        case "lt": query.lt(snakeKey, opValue); break;
        case "lte": query.lte(snakeKey, opValue); break;
        case "in": query.in(snakeKey, opValue as any[]); break;
        case "notIn": query.not.in(snakeKey, opValue as any[]); break;
      }
    }
  } else if (Array.isArray(value)) {
    query.in(snakeKey, value);
  } else {
    query.eq(snakeKey, value);
  }
}

// ─── Select string builder ───────────────────────────────────

interface SelectResult {
  selectString: string;
  hasCountSelect: boolean;
  countSelectRelations: Record<string, boolean>;
}

function buildSelectString(
  modelName: string,
  include?: Record<string, any>,
  select?: Record<string, boolean>
): SelectResult {
  const result: SelectResult = {
    selectString: "*",
    hasCountSelect: false,
    countSelectRelations: {},
  };

  if (select) {
    // Handle explicit select (specific columns) + _count
    const cols: string[] = [];
    for (const [key, val] of Object.entries(select)) {
      const countVal = val as any;
      if (key === "_count" && countVal?.select) {
        result.hasCountSelect = true;
        result.countSelectRelations = countVal.select;
      } else if (val) {
        const snakeKey = CAMEL_TO_SNAKE[key] || key;
        cols.push(snakeKey);
      }
    }
    result.selectString = cols.join(",") || "id";
    return result;
  }

  if (!include) return result;

  // Handle includes with relations and _count
  for (const [key, val] of Object.entries(include)) {
    const incVal = val as any;
    if (key === "_count" && incVal?.select) {
      result.hasCountSelect = true;
      result.countSelectRelations = incVal.select;
    }
  }

  return result;
}

// ─── Relation Lookup ─────────────────────────────────────────

function findRelation(modelName: string, relationKey: string): RelationDef | null {
  const relations = RELATIONS[modelName];
  if (!relations) return null;
  return relations[relationKey] || null;
}

// ─── Supabase Model Class ────────────────────────────────────

class SupabaseModel {
  private supabase: SupabaseClient;
  private tableName: string;
  private modelName: string;

  constructor(supabase: SupabaseClient, modelName: string) {
    this.supabase = supabase;
    this.modelName = modelName;
    this.tableName = MODEL_TO_TABLE[modelName] || modelName;
  }

  private getClient() {
    return this.supabase;
  }

  async findMany(options: Record<string, any> = {}): Promise<Record<string, any>[]> {
    const { where, orderBy, skip, take, include, select, distinct } = options;

    const { selectString, hasCountSelect, countSelectRelations } = buildSelectString(
      this.modelName, include, select
    );

    let query = this.getClient()
      .from(this.tableName)
      .select(selectString, { count: "exact" });

    if (where) {
      query = buildFilters(query, where);
    }

    if (orderBy) {
      const orders = Array.isArray(orderBy) ? orderBy : [orderBy];
      for (const order of orders) {
        for (const [key, dir] of Object.entries(order)) {
          const snakeKey = CAMEL_TO_SNAKE[key] || key;
          query = query.order(snakeKey, { ascending: dir === "asc" });
        }
      }
    }

    if (skip !== undefined || take !== undefined) {
      const from = skip || 0;
      const to = take ? from + take - 1 : 9999999;
      query = query.range(from, to);
    }

    const { data, error } = await query;
    if (error) throw error;

    let results = data ? data.map(toCamel) : [];

    // Resolve includes via post-processing (avoid PostgREST embed complexities)
    if (include) {
      results = await this.resolveIncludes(results, include);
    }

    // Handle _count in select
    if (hasCountSelect) {
      results = await this.resolveIncludeCounts(results, countSelectRelations);
    }

    return results;
  }

  private async resolveIncludes(
    items: Record<string, any>[],
    include: Record<string, any>
  ): Promise<Record<string, any>[]> {
    const relations = RELATIONS[this.modelName];
    if (!relations) return items;

    for (const item of items) {
      for (const [key, includeValue] of Object.entries(include)) {
        if (!includeValue) continue;
        if (key === "_count") continue;

        const relation = relations[key];
        if (!relation) continue;

        // Find the camelCase version of the foreign key
        const fkParts = relation.foreignKey.split("_");
        const camelFK = fkParts[0] + fkParts.slice(1).map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
        const fkValue = item[camelFK] ?? item[relation.foreignKey];

        if (relation.type === "one") {
          let relatedItem: Record<string, any> | null = null;

          if (fkValue === null || fkValue === undefined) {
            const { data } = await this.getClient()
              .from(relation.table)
              .select("*")
              .eq(relation.foreignKey, item.id)
              .limit(1);
            relatedItem = data && data.length > 0 ? toCamel(data[0]) : null;
          } else {
            const { data } = await this.getClient()
              .from(relation.table)
              .select("*")
              .eq("id", fkValue)
              .limit(1);
            relatedItem = data && data.length > 0 ? toCamel(data[0]) : null;
          }

          item[key] = relatedItem;

          if (relatedItem && typeof includeValue === "object" && includeValue !== true) {
            const nestedInclude = includeValue.include;
            if (nestedInclude) {
              const nestedModel = findModelName(relation.table);
              if (nestedModel) {
                const tempModel = new SupabaseModel(this.supabase, nestedModel);
                item[key] = (await tempModel.resolveIncludes([relatedItem], nestedInclude))[0];
              }
            }
          }
        } else if (relation.type === "many") {
          const matchValue = item.id;
          let query = this.getClient()
            .from(relation.table)
            .select("*")
            .eq(relation.foreignKey, matchValue);

          // Handle nested includes/selects/orderBy/take
          if (typeof includeValue === "object" && includeValue !== true) {
            const nestedOrderBy = includeValue.orderBy;
            const nestedTake = includeValue.take;
            const nestedSkip = includeValue.skip;
            const nestedWhere = includeValue.where;

            if (nestedWhere) {
              query = buildFilters(query, nestedWhere);
            }

            if (nestedOrderBy) {
              const orders = Array.isArray(nestedOrderBy) ? nestedOrderBy : [nestedOrderBy];
              for (const order of orders) {
                for (const [k, dir] of Object.entries(order)) {
                  const snakeK = CAMEL_TO_SNAKE[k] || k;
                  query = query.order(snakeK, { ascending: dir === "asc" });
                }
              }
            }

            if (nestedSkip) {
              query = query.range(nestedSkip, 9999999);
            }

            if (nestedTake) {
              query = query.limit(nestedTake);
            }
          }

          const { data } = await query;
          let relatedItems = data ? data.map(toCamel) : [];

          // Handle nested includes on related items
          if (typeof includeValue === "object" && includeValue !== true) {
            const nestedInclude = includeValue.include;
            if (nestedInclude) {
              const nestedModel = findModelName(relation.table);
              if (nestedModel) {
                const tempModel = new SupabaseModel(this.supabase, nestedModel);
                relatedItems = await tempModel.resolveIncludes(relatedItems, nestedInclude);
              }
            }
          }

          item[key] = relatedItems;
        }
      }
    }
    return items;
  }

  private async resolveIncludeCounts(
    items: Record<string, any>[],
    countSelect: Record<string, boolean>
  ): Promise<Record<string, any>[]> {
    for (const item of items) {
      const counts: Record<string, number> = {};
      for (const [rel, enabled] of Object.entries(countSelect)) {
        if (enabled) {
          const relation = findRelation(this.modelName, rel);
          if (relation) {
            const { count } = await this.getClient()
              .from(relation.table)
              .select("*", { count: "exact", head: true })
              .eq(relation.foreignKey, item.id);
            counts[rel] = count || 0;
          }
        }
      }
      item._count = { ...(item._count || {}), ...counts };
    }
    return items;
  }

  async findUnique(options: Record<string, any>): Promise<Record<string, any> | null> {
    const { where, include, select } = options;
    if (!where) return null;

    const { selectString, hasCountSelect, countSelectRelations } = buildSelectString(
      this.modelName, include, select
    );

    let query = this.getClient()
      .from(this.tableName)
      .select(selectString)
      .limit(1);

    query = buildFilters(query, where);

    const { data, error } = await query;
    if (error) throw error;

    if (!data || data.length === 0) return null;

    let result = toCamel(data[0]);

    // Resolve includes
    if (include) {
      [result] = await this.resolveIncludes([result], include);
    }

    // Handle _count
    if (hasCountSelect) {
      [result] = await this.resolveIncludeCounts([result], countSelectRelations);
    }

    return result;
  }

  async findFirst(options: Record<string, any> = {}): Promise<Record<string, any> | null> {
    const results = await this.findMany({ ...options, take: 1 });
    return results[0] || null;
  }

  async create(options: Record<string, any>): Promise<Record<string, any>> {
    const data = { ...options.data };

    // Handle nested creates (e.g., items: { create: [...] })
    const nestedIncludes: Record<string, any> = {};
    if (options.include) {
      for (const [key, value] of Object.entries(options.include)) {
        if (options.data[key]?.create) {
          nestedIncludes[key] = { create: options.data[key].create };
          delete data[key];
        }
      }
    }

    // Auto-generate ID if not provided
    if (!data.id) {
      data.id = crypto.randomUUID().replace(/-/g, "").slice(0, 25);
    }

    // Default created_at timestamp (most tables have this column)
    if (!data.createdAt) data.createdAt = new Date();
    // Only add updatedAt if the model's table supports it
    // (Tables like analytics_event, product_image, order_item, etc. don't have updated_at)
    if (this.modelName && MODELS_WITH_UPDATED_AT.has(this.modelName)) {
      if (!data.updatedAt) data.updatedAt = new Date();
    }

    const snakeData = toSnake(data);

    const { data: result, error } = await this.getClient()
      .from(this.tableName)
      .insert(snakeData)
      .select()
      .single();

    if (error) throw error;

    const created = toCamel(result);

    // Create nested items
    try {
      for (const [key, nested] of Object.entries(nestedIncludes)) {
        const relation = findRelation(this.modelName, key);
        if (relation && nested.create) {
          const items = Array.isArray(nested.create) ? nested.create : [nested.create];
          for (const item of items) {
            item[relation.foreignKey] = created.id;
            // Auto-generate ID for nested items if not provided
            if (!item.id) {
              item.id = crypto.randomUUID().replace(/-/g, "").slice(0, 25);
            }
            const snakeNested = toSnake(item);
            const { error } = await this.getClient()
              .from(relation.table)
              .insert(snakeNested)
              .select()
              .single();
            if (error) {
              console.error(`[SupabaseModel] Nested create failed for ${key}:`, error.message, snakeNested);
              throw error;
            }
          }
        }
      }
    } catch (createError) {
      // Since transactions are sequential over REST, we can't roll back automatically.
      // Attempt best-effort cleanup of the created parent record to avoid orphaned rows.
      try {
        await this.getClient()
          .from(this.tableName)
          .delete()
          .eq("id", created.id);
      } catch (cleanupError) {
        console.error(`[SupabaseModel] Failed cleanup after nested create error for ${this.tableName}:`, cleanupError);
      }
      throw createError;
    }

    // Reload with includes
    if (options.include) {
      return (await this.findUnique({ where: { id: created.id }, include: options.include })) || created;
    }

    return created;
  }

  async createMany(options: Record<string, any>): Promise<{ count: number }> {
    const items = Array.isArray(options.data) ? options.data : [options.data];

    const records = items.map((item: any) => {
      const d = { ...item };
      if (!d.id) {
        d.id = crypto.randomUUID().replace(/-/g, "").slice(0, 25);
      }
      if (!d.createdAt) d.createdAt = new Date();
      // Don't auto-add updatedAt - many tables don't have this column
      return toSnake(d);
    });

    const { error, count } = await this.getClient()
      .from(this.tableName)
      .insert(records)
      .select();

    if (error) throw error;
    return { count: count || records.length };
  }

  async update(options: Record<string, any>): Promise<Record<string, any>> {
    const { where, data, include } = options;
    if (!where) throw new Error("where is required for update");

    // Only add updatedAt if the model supports it
    const updateData = { ...data };
    if (this.modelName && MODELS_WITH_UPDATED_AT.has(this.modelName) && !updateData.updatedAt) {
      updateData.updatedAt = new Date();
    }
    const snakeData = toSnake(updateData);

    let query = this.getClient()
      .from(this.tableName)
      .update(snakeData)
      .select();

    query = buildFilters(query, where);

    const { data: result, error } = await query.single();
    if (error) throw error;

    const updated = toCamel(result);

    if (include) {
      return (await this.findUnique({ where: { id: updated.id }, include })) || updated;
    }

    return updated;
  }

  async updateMany(options: Record<string, any>): Promise<{ count: number }> {
    const { where, data } = options;
    if (!data) return { count: 0 };

    // Only add updatedAt if the model supports it
    const updateData = { ...data };
    if (this.modelName && MODELS_WITH_UPDATED_AT.has(this.modelName) && !updateData.updatedAt) {
      updateData.updatedAt = new Date();
    }
    const snakeData = toSnake(updateData);

    let query = this.getClient()
      .from(this.tableName)
      .update(snakeData);

    if (where) {
      query = buildFilters(query, where);
    }

    const { error, count } = await query;
    if (error) throw error;
    return { count: count || 0 };
  }

  async upsert(options: Record<string, any>): Promise<Record<string, any>> {
    const { where, update, create } = options;

    const existing = await this.findFirst({ where });

    if (existing) {
      return this.update({ where, data: update, ...(options.include ? { include: options.include } : {}) });
    } else {
      return this.create({
        data: { ...create },
        ...(options.include ? { include: options.include } : {}),
      });
    }
  }

  async delete(options: Record<string, any>): Promise<Record<string, any>> {
    const { where } = options;
    if (!where) throw new Error("where is required for delete");

    let query = this.getClient()
      .from(this.tableName)
      .delete()
      .select();

    query = buildFilters(query, where);

    const { data, error } = await query.single();
    if (error) throw error;

    return toCamel(data);
  }

  async deleteMany(options: Record<string, any> = {}): Promise<{ count: number }> {
    let query = this.getClient()
      .from(this.tableName)
      .delete();

    if (options.where) {
      query = buildFilters(query, options.where);
    }

    const { error, count } = await query;
    if (error) throw error;
    return { count: count || 0 };
  }

  async count(options: Record<string, any> = {}): Promise<number> {
    let query = this.getClient()
      .from(this.tableName)
      .select("*", { count: "exact", head: true });

    if (options.where) {
      query = buildFilters(query, options.where);
    }

    const { count, error } = await query;
    if (error) throw error;
    return count || 0;
  }

  async aggregate(options: Record<string, any>): Promise<Record<string, any>> {
    const { where, _count, _sum, _avg, _min, _max } = options;

    const records = await this.findMany({ where });

    const result: Record<string, any> = {};

    if (_count) {
      if (_count === true || _count?.id) {
        result._count = { id: records.length };
      } else {
        const countResult: Record<string, number> = {};
        for (const [field, val] of Object.entries(_count)) {
          if (val) {
            countResult[field] = records.filter((r: any) => r[field] !== null && r[field] !== undefined).length;
          }
        }
        result._count = countResult;
      }
    }

    if (_sum) {
      const sumResult: Record<string, number> = {};
      for (const [field, val] of Object.entries(_sum)) {
        if (val) {
          sumResult[field] = records.reduce((s: number, r: any) => s + (Number(r[field]) || 0), 0);
        }
      }
      result._sum = sumResult;
    }

    if (_avg) {
      const avgResult: Record<string, number> = {};
      for (const [field, val] of Object.entries(_avg)) {
        if (val) {
          const valid = records.filter((r: any) => r[field] !== null && r[field] !== undefined);
          avgResult[field] = valid.length > 0
            ? valid.reduce((s: number, r: any) => s + Number(r[field]), 0) / valid.length
            : 0;
        }
      }
      result._avg = avgResult;
    }

    if (_min) {
      const minResult: Record<string, any> = {};
      for (const [field, val] of Object.entries(_min)) {
        if (val) {
          const values = records.map((r: any) => r[field]).filter((v: any) => v !== null && v !== undefined);
          minResult[field] = values.length > 0 ? values.reduce((a: any, b: any) => a < b ? a : b) : null;
        }
      }
      result._min = minResult;
    }

    if (_max) {
      const maxResult: Record<string, any> = {};
      for (const [field, val] of Object.entries(_max)) {
        if (val) {
          const values = records.map((r: any) => r[field]).filter((v: any) => v !== null && v !== undefined);
          maxResult[field] = values.length > 0 ? values.reduce((a: any, b: any) => a > b ? a : b) : null;
        }
      }
      result._max = maxResult;
    }

    return result;
  }

  async groupBy(options: Record<string, any>): Promise<Record<string, any>[]> {
    const { by, where, _count, _sum, _avg, _min, _max, orderBy, take } = options;

    const records = await this.findMany({ where });

    const groups = new Map<string, Record<string, any>[]>();
    for (const record of records) {
      const key = by.map((field: string) => String(record[field])).join("|");
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(record);
    }

    const results: Record<string, any>[] = [];
    for (const [key, items] of groups) {
      const keyParts = key.split("|");
      const groupResult: Record<string, any> = {};

      by.forEach((field: string, index: number) => {
        groupResult[field] = keyParts[index];
      });

      if (_count) {
        if (_count === true || _count?.id) {
          groupResult._count = { id: items.length };
        } else {
          const countResult: Record<string, number> = {};
          for (const [field, val] of Object.entries(_count)) {
            if (val) {
              countResult[field] = items.filter((i: any) => i[field] !== null && i[field] !== undefined).length;
            }
          }
          groupResult._count = countResult;
        }
      }

      if (_sum) {
        const sumResult: Record<string, number> = {};
        for (const [field, val] of Object.entries(_sum)) {
          if (val) {
            sumResult[field] = items.reduce((s: number, i: any) => s + (Number(i[field]) || 0), 0);
          }
        }
        groupResult._sum = sumResult;
      }

      if (_avg) {
        const avgResult: Record<string, number> = {};
        for (const [field, val] of Object.entries(_avg)) {
          if (val) {
            const valid = items.filter((i: any) => i[field] !== null && i[field] !== undefined);
            avgResult[field] = valid.length > 0
              ? valid.reduce((s: number, i: any) => s + Number(i[field]), 0) / valid.length
              : 0;
          }
        }
        groupResult._avg = avgResult;
      }

      if (_min) {
        const minResult: Record<string, any> = {};
        for (const [field, val] of Object.entries(_min)) {
          if (val) {
            const values = items.map((i: any) => i[field]).filter((v: any) => v !== null && v !== undefined);
            minResult[field] = values.length > 0 ? values.reduce((a: any, b: any) => a < b ? a : b) : null;
          }
        }
        groupResult._min = minResult;
      }

      if (_max) {
        const maxResult: Record<string, any> = {};
        for (const [field, val] of Object.entries(_max)) {
          if (val) {
            const values = items.map((i: any) => i[field]).filter((v: any) => v !== null && v !== undefined);
            maxResult[field] = values.length > 0 ? values.reduce((a: any, b: any) => a > b ? a : b) : null;
          }
        }
        groupResult._max = maxResult;
      }

      results.push(groupResult);
    }

    if (orderBy) {
      const orders = Array.isArray(orderBy) ? orderBy : [orderBy];
      results.sort((a, b) => {
        for (const order of orders) {
          for (const [key, dir] of Object.entries(order)) {
            const dirNum = dir === "asc" ? 1 : -1;
            const aVal = a[key] ?? a._count?.[key] ?? a._sum?.[key] ?? 0;
            const bVal = b[key] ?? b._count?.[key] ?? b._sum?.[key] ?? 0;
            if (aVal !== bVal) return (Number(aVal) - Number(bVal)) * dirNum;
          }
        }
        return 0;
      });
    }

    if (take) {
      return results.slice(0, take);
    }

    return results;
  }
}

// ─── Helper ──────────────────────────────────────────────────

function findModelName(tableName: string): string | null {
  for (const [model, table] of Object.entries(MODEL_TO_TABLE)) {
    if (table === tableName) return model;
  }
  return null;
}

// ─── Database instance ───────────────────────────────────────

const db = supabaseAdmin;

function createModel(modelName: string): SupabaseModel {
  return new SupabaseModel(db, modelName);
}

export const prisma = {
  // Models
  store: createModel("store"),
  user: createModel("user"),
  refreshToken: createModel("refreshToken"),
  category: createModel("category"),
  product: createModel("product"),
  productImage: createModel("productImage"),
  order: createModel("order"),
  orderItem: createModel("orderItem"),
  payment: createModel("payment"),
  analyticsEvent: createModel("analyticsEvent"),
  salesForecast: createModel("salesForecast"),
  customerSegment: createModel("customerSegment"),
  productRecommendation: createModel("productRecommendation"),
  stockAlert: createModel("stockAlert"),
  notification: createModel("notification"),
  setting: createModel("setting"),
  testimonial: createModel("testimonial"),
  faq: createModel("faq"),
  banner: createModel("banner"),
  activityLog: createModel("activityLog"),
  inventoryLog: createModel("inventoryLog"),
  wishlist: createModel("wishlist"),
  currencyRate: createModel("currencyRate"),

  // Transaction support - sequential execution (no real DB transaction over REST)
  async $transaction<T>(
    operations: ((tx: any) => Promise<T>)[] | ((tx: any) => Promise<T>)
  ): Promise<T> {
    if (typeof operations === "function") {
      return operations(prisma);
    }
    const results: T[] = [];
    for (const operation of operations) {
      results.push(await operation(prisma));
    }
    return results as any;
  },

  // Raw query support
  async $queryRaw(strings: TemplateStringsArray | string, ...values: any[]): Promise<any> {
    const sql = typeof strings === "string" ? strings : String.raw(strings as any, ...values);
    if (sql.trim().toUpperCase().startsWith("SELECT 1")) {
      return [{ "1": 1 }];
    }
    try {
      const { data } = await db.rpc("exec_sql", { query: sql });
      return data || [];
    } catch {
      return [];
    }
  },

  async $disconnect(): Promise<void> {
    // No-op
  },
};

export default prisma;
export { SupabaseModel };

// Exported for testing
export {
  CAMEL_TO_SNAKE,
  SNAKE_TO_CAMEL,
  MODEL_TO_TABLE,
  RELATIONS,
  buildSelectString,
  buildFilters,
  applySimpleFilter,
  findRelation,
  findModelName,
  toSnake,
  toCamel,
};
