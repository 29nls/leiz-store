/**
 * Prisma-Compatible Type Definitions
 * Replaces @generated/prisma/client for JSON-based database
 */

// ─── Enums ────────────────────────────────────────────────────

export const Role = {
  CUSTOMER: "CUSTOMER",
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const OrderStatus = {
  PENDING: "PENDING",
  PENDING_PAYMENT: "PENDING_PAYMENT",
  WAITING_PAYMENT: "WAITING_PAYMENT",
  WAITING_CONFIRMATION: "WAITING_CONFIRMATION",
  PAID: "PAID",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  REJECTED: "REJECTED",
  NEEDS_REVIEW: "NEEDS_REVIEW",
  CANCELLED: "CANCELLED",
  FORCE_CANCELLED: "FORCE_CANCELLED",
  REFUNDED: "REFUNDED",
  EXPIRED: "EXPIRED",
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const PaymentStatus = {
  PENDING: "PENDING",
  PAID: "PAID",
  VERIFIED: "VERIFIED",
  FAILED: "FAILED",
  REFUNDED: "REFUNDED",
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const PaymentMethod = {
  BANK_TRANSFER: "bank_transfer",
  GOPAY: "gopay",
  DANA: "dana",
  SEABANK: "seabank",
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const NotificationStatus = {
  PENDING: "PENDING",
  SENT: "SENT",
  FAILED: "FAILED",
} as const;
export type NotificationStatus = (typeof NotificationStatus)[keyof typeof NotificationStatus];

export const NotificationChannel = {
  SMS: "SMS",
  DISCORD: "DISCORD",
  WHATSAPP: "WHATSAPP",
  EMAIL: "EMAIL",
} as const;
export type NotificationChannel = (typeof NotificationChannel)[keyof typeof NotificationChannel];

export const StockAlertType = {
  LOW_STOCK: "LOW_STOCK",
  OUT_OF_STOCK: "OUT_OF_STOCK",
} as const;
export type StockAlertType = (typeof StockAlertType)[keyof typeof StockAlertType];

// ─── Model Types ──────────────────────────────────────────────

export interface Store {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  logo?: string | null;
  favicon?: string | null;
  domain?: string | null;
  isActive: boolean;
  settings?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  publicId?: string;
  email: string;
  password: string;
  name: string;
  role: Role;
  avatar?: string | null;
  discord?: string | null;
  phone?: string | null;
  isActive: boolean;
  lastLoginAt?: Date | null;
  storeId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RefreshToken {
  id: string;
  token: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface Category {
  id: string;
  publicId?: string;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  image?: string | null;
  sortOrder: number;
  isActive: boolean;
  parentId?: string | null;
  storeId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Product {
  id: string;
  publicId?: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  priceUSD?: number | null;
  comparePrice?: number | null;
  comparePriceUSD?: number | null;
  unit: string;
  stock: number;
  minStock: number;
  badge?: string | null;
  isActive: boolean;
  isFeatured: boolean;
  tags?: any;
  categoryId: string;
  storeId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductImage {
  id: string;
  productId: string;
  url: string;
  alt?: string | null;
  sortOrder: number;
}

export interface Order {
  id: string;
  publicId?: string;
  orderNumber: string;
  status: OrderStatus;
  customerName: string;
  customerEmail?: string | null;
  customerDiscord?: string | null;
  customerIGN?: string | null;
  customerNotes?: string | null;
  buyerDiscordId?: string | null;
  subtotal: number;
  subtotalUSD?: number | null;
  tax: number;
  taxUSD?: number | null;
  discount: number;
  discountUSD?: number | null;
  total: number;
  totalUSD?: number | null;
  currency: string;
  paymentMethod?: string | null;
  paymentProof?: string | null;
  paymentRef?: string | null;
  expiryAt?: Date | null;
  confirmedAt?: Date | null;
  paidAt?: Date | null;
  completedAt?: Date | null;
  cancelledAt?: Date | null;
  userId?: string | null;
  storeId?: string | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  name: string;
  price: number;
  priceUSD?: number | null;
  quantity: number;
  total: number;
  totalUSD?: number | null;
}

export interface Payment {
  id: string;
  orderId: string;
  method: string;
  amount: number;
  amountUSD?: number | null;
  currency: string;
  status: PaymentStatus;
  proof?: string | null;
  accountNumber?: string | null;
  accountName?: string | null;
  notes?: string | null;
  verifiedAt?: Date | null;
  paidAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentConfirmation {
  id: string;
  orderId: string;
  buyerName: string;
  buyerDiscordId?: string | null;
  note?: string | null;
  createdAt: Date;
}

export interface OrderLog {
  id: string;
  orderId: string;
  actorType: string;
  actorId?: string | null;
  action: string;
  previousStatus?: string | null;
  newStatus?: string | null;
  metadata?: any;
  createdAt: Date;
}

export interface AnalyticsEvent {
  id: string;
  event: string;
  entity?: string | null;
  entityId?: string | null;
  userId?: string | null;
  metadata?: any;
  storeId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: Date;
}

export interface SalesForecast {
  id: string;
  productId?: string | null;
  categoryId?: string | null;
  storeId?: string | null;
  period: string;
  predictedValue: number;
  actualValue?: number | null;
  confidence: number;
  algorithm: string;
  createdAt: Date;
}

export interface CustomerSegment {
  id: string;
  userId: string;
  segment: string;
  rfmScore: string;
  frequency: number;
  monetary: number;
  recencyDays: number;
  lifetimeValue: number;
  lastCalculated: Date;
  createdAt: Date;
}

export interface ProductRecommendation {
  id: string;
  sourceProductId: string;
  recommendedProductId: string;
  score: number;
  algorithm: string;
  isActive: boolean;
  createdAt: Date;
}

export interface StockAlert {
  id: string;
  productId: string;
  type: StockAlertType;
  threshold: number;
  currentStock: number;
  isRead: boolean;
  isSent: boolean;
  sentVia?: string | null;
  storeId?: string | null;
  createdAt: Date;
}

export interface Notification {
  id: string;
  channel: NotificationChannel;
  recipient: string;
  subject: string;
  body: string;
  status: NotificationStatus;
  metadata?: any;
  storeId?: string | null;
  sentAt?: Date | null;
  createdAt: Date;
}

export interface Setting {
  id: string;
  key: string;
  value: string;
  type: string;
  group: string;
}

export interface Testimonial {
  id: string;
  name: string;
  avatar?: string | null;
  rating: number;
  content: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category?: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
}

export interface Banner {
  id: string;
  title: string;
  subtitle?: string | null;
  image: string;
  link?: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
}

export interface ActivityLog {
  id: string;
  userId?: string | null;
  action: string;
  entity?: string | null;
  entityId?: string | null;
  details?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  storeId?: string | null;
  createdAt: Date;
}

export interface InventoryLog {
  id: string;
  productId: string;
  change: number;
  previousStock: number;
  newStock: number;
  reason: string;
  reference?: string | null;
  userId?: string | null;
  createdAt: Date;
}

export interface Wishlist {
  id: string;
  userId: string;
  productId: string;
  createdAt: Date;
}

export interface CurrencyRate {
  id: string;
  from: string;
  to: string;
  rate: number;
  source: string;
  updatedAt: Date;
}

// ─── Prisma Namespace (Compatibility Layer) ───────────────────

export namespace Prisma {
  // Input types
  export type InputJsonValue = string | number | boolean | null | InputJsonObject | InputJsonArray;
  export interface InputJsonObject {
    [key: string]: InputJsonValue;
  }
  export interface InputJsonArray extends Array<InputJsonValue> {}

  export type Decimal = number;

  // Where input types
  export type ProductWhereInput = {
    isActive?: boolean;
    category?: { slug?: string };
    OR?: ProductWhereInput[];
    name?: { contains?: string };
    description?: { contains?: string };
    price?: { gte?: number; lte?: number };
    priceUSD?: { gte?: number; lte?: number };
    badge?: string;
    isFeatured?: boolean;
    storeId?: string;
    createdAt?: { gte?: Date; lte?: Date };
    stock?: { lte?: number; gte?: number };
    [key: string]: any;
  };

  export type CategoryWhereInput = {
    parentId?: null | string;
    isActive?: boolean;
    storeId?: string;
    [key: string]: any;
  };

  export type OrderWhereInput = {
    status?: { in?: string[]; not?: string } | string;
    createdAt?: { gte?: Date; lte?: Date };
    storeId?: string;
    paymentMethod?: { not?: null } | string;
    OR?: OrderWhereInput[];
    [key: string]: any;
  };

  export type UserWhereInput = {
    role?: Role;
    isActive?: boolean;
    createdAt?: { gte?: Date };
    OR?: UserWhereInput[];
    [key: string]: any;
  };

  export type ActivityLogWhereInput = {
    userId?: string;
    action?: string;
    createdAt?: { gte?: Date };
    [key: string]: any;
  };

  export type InventoryLogWhereInput = {
    productId?: string;
    createdAt?: { gte?: Date };
    [key: string]: any;
  };

  export type AnalyticsEventWhereInput = {
    event?: string;
    createdAt?: { gte?: Date; lte?: Date };
    storeId?: string;
    [key: string]: any;
  };

  export type StockAlertWhereInput = {
    productId?: string;
    isRead?: boolean;
    storeId?: string;
    [key: string]: any;
  };

  export type NotificationWhereInput = {
    channel?: string;
    status?: string;
    storeId?: string;
    [key: string]: any;
  };

  export type SalesForecastWhereInput = {
    productId?: string;
    categoryId?: string;
    storeId?: string;
    createdAt?: { gte?: Date };
    [key: string]: any;
  };

  export type CustomerSegmentWhereInput = {
    userId?: string;
    segment?: string;
    [key: string]: any;
  };

  export type ProductRecommendationWhereInput = {
    sourceProductId?: string;
    recommendedProductId?: string;
    isActive?: boolean;
    [key: string]: any;
  };

  // Order by types
  export type ProductOrderByWithRelationInput = {
    price?: "asc" | "desc";
    createdAt?: "asc" | "desc";
    name?: "asc" | "desc";
    [key: string]: any;
  };

  // Create/Update input types
  export type ProductCreateInput = {
    name: string;
    slug: string;
    description: string;
    price: number;
    priceUSD?: number;
    comparePrice?: number;
    comparePriceUSD?: number;
    unit?: string;
    stock?: number;
    minStock?: number;
    badge?: string;
    isActive?: boolean;
    isFeatured?: boolean;
    tags?: any;
    categoryId: string;
    storeId?: string;
    images?: { create: any };
    [key: string]: any;
  };

  export type ProductUpdateInput = {
    name?: string;
    slug?: string;
    description?: string;
    price?: number;
    priceUSD?: number;
    comparePrice?: number;
    comparePriceUSD?: number;
    unit?: string;
    stock?: number;
    minStock?: number;
    badge?: string;
    isActive?: boolean;
    isFeatured?: boolean;
    tags?: any;
    categoryId?: string;
    storeId?: string;
    [key: string]: any;
  };

  export type CategoryCreateInput = {
    name: string;
    slug: string;
    description?: string;
    icon?: string;
    image?: string;
    sortOrder?: number;
    isActive?: boolean;
    parentId?: string;
    storeId?: string;
    [key: string]: any;
  };

  export type CategoryUpdateInput = {
    name?: string;
    slug?: string;
    description?: string;
    icon?: string;
    image?: string;
    sortOrder?: number;
    isActive?: boolean;
    parentId?: string;
    storeId?: string;
    [key: string]: any;
  };

  export type OrderCreateInput = {
    orderNumber: string;
    status: OrderStatus;
    customerName: string;
    customerEmail?: string;
    customerDiscord?: string;
    customerIGN?: string;
    customerNotes?: string;
    buyerDiscordId?: string;
    subtotal: number;
    subtotalUSD?: number;
    tax?: number;
    taxUSD?: number;
    discount?: number;
    discountUSD?: number;
    total: number;
    totalUSD?: number;
    currency?: string;
    paymentMethod?: string;
    expiryAt?: Date;
    userId?: string;
    storeId?: string;
    items?: { create: any };
    [key: string]: any;
  };

  export type OrderUpdateInput = {
    status?: OrderStatus;
    buyerDiscordId?: string;
    expiryAt?: Date;
    confirmedAt?: Date;
    paidAt?: Date;
    completedAt?: Date;
    cancelledAt?: Date;
    [key: string]: any;
  };

  export type UserCreateInput = {
    email: string;
    password: string;
    name: string;
    role: Role;
    avatar?: string;
    discord?: string;
    phone?: string;
    storeId?: string;
    [key: string]: any;
  };

  export type UserUpdateInput = {
    email?: string;
    password?: string;
    name?: string;
    role?: Role;
    avatar?: string;
    discord?: string;
    phone?: string;
    isActive?: boolean;
    lastLoginAt?: Date;
    storeId?: string;
    [key: string]: any;
  };

  // FindMany args types
  export type ProductFindManyArgs = {
    where?: ProductWhereInput;
    orderBy?: ProductOrderByWithRelationInput | ProductOrderByWithRelationInput[];
    skip?: number;
    take?: number;
    include?: Record<string, any>;
    select?: Record<string, boolean>;
    distinct?: string[];
  };

  export type CategoryFindManyArgs = {
    where?: CategoryWhereInput;
    orderBy?: Record<string, "asc" | "desc">;
    skip?: number;
    take?: number;
    include?: Record<string, any>;
    select?: Record<string, boolean>;
  };

  export type OrderFindManyArgs = {
    where?: OrderWhereInput;
    orderBy?: Record<string, "asc" | "desc">;
    skip?: number;
    take?: number;
    include?: Record<string, any>;
    select?: Record<string, boolean>;
  };

  export type UserFindManyArgs = {
    where?: UserWhereInput;
    orderBy?: Record<string, "asc" | "desc">;
    skip?: number;
    take?: number;
    include?: Record<string, any>;
    select?: Record<string, boolean>;
  };

  export type ActivityLogFindManyArgs = {
    where?: ActivityLogWhereInput;
    orderBy?: Record<string, "asc" | "desc">;
    skip?: number;
    take?: number;
    include?: Record<string, any>;
    select?: Record<string, boolean>;
  };

  export type InventoryLogFindManyArgs = {
    where?: InventoryLogWhereInput;
    orderBy?: Record<string, "asc" | "desc">;
    skip?: number;
    take?: number;
    include?: Record<string, any>;
    select?: Record<string, boolean>;
  };

  export type AnalyticsEventFindManyArgs = {
    where?: AnalyticsEventWhereInput;
    orderBy?: Record<string, "asc" | "desc">;
    skip?: number;
    take?: number;
  };

  export type StockAlertFindManyArgs = {
    where?: StockAlertWhereInput;
    orderBy?: Record<string, "asc" | "desc">;
    skip?: number;
    take?: number;
  };

  export type NotificationFindManyArgs = {
    where?: NotificationWhereInput;
    orderBy?: Record<string, "asc" | "desc">;
    skip?: number;
    take?: number;
  };

  export type SalesForecastFindManyArgs = {
    where?: SalesForecastWhereInput;
    orderBy?: Record<string, "asc" | "desc">;
    skip?: number;
    take?: number;
  };

  export type CustomerSegmentFindManyArgs = {
    where?: CustomerSegmentWhereInput;
    orderBy?: Record<string, "asc" | "desc">;
    skip?: number;
    take?: number;
  };

  export type ProductRecommendationFindManyArgs = {
    where?: ProductRecommendationWhereInput;
    orderBy?: Record<string, "asc" | "desc">;
    skip?: number;
    take?: number;
    include?: Record<string, any>;
  };
}
