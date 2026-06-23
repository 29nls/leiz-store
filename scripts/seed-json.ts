/**
 * LEIZ STORE - JSON Database Seed Script
 *
 * Populates the JSON database with realistic game store data.
 * Run with: npx tsx scripts/seed-json.ts
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";

const DATA_DIR = path.join(process.cwd(), "data");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ─── Helpers ──────────────────────────────────────────────────

function cuid(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 25);
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const key = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512");
  return `${salt}:${key.toString("hex")}`;
}

function randomDate(daysBack: number): Date {
  const now = Date.now();
  const past = now - daysBack * 24 * 60 * 60 * 1000;
  return new Date(past + Math.random() * (now - past));
}

function generateOrderNumber(date: Date, index: number): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `LZ-${y}${m}${d}-${rand}`;
}

function writeJson(filename: string, data: any[]): void {
  const filePath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  console.log(`   ✅ Wrote ${data.length} records to ${filename}`);
}

// ─── Data ─────────────────────────────────────────────────────

const CATEGORIES = [
  { id: cuid(), name: "Insane DN", slug: "insane-dn", icon: "⚔️", description: "Dragon Nest premium items and in-game goods for Insane DN", sortOrder: 1, isActive: true, parentId: null, storeId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

const PRODUCTS_DATA = [
  { name: "Balkov Pouch", slug: "balkov-pouch", price: 150000, comparePrice: 180000, unit: "pc", stock: 100, minStock: 10, badge: "HOT", categorySlug: "insane-dn", featured: true, description: "Balkov Pouch for Dragon Nest Insane. Contains powerful equipment and rare materials to boost your character." },
  { name: "Minotaur Pouch", slug: "minotaur-pouch", price: 175000, comparePrice: 210000, unit: "pc", stock: 80, minStock: 10, badge: "HOT", categorySlug: "insane-dn", featured: true, description: "Minotaur Pouch for Dragon Nest Insane. Packed with exclusive Minotaur-grade gear and crafting items." },
  { name: "Mount Coupon", slug: "mount-coupon", price: 250000, comparePrice: 300000, unit: "pc", stock: 50, minStock: 5, badge: "BEST_SELLER", categorySlug: "insane-dn", featured: true, description: "Mount Coupon for Dragon Nest. Redeem for an exclusive in-game mount to travel the world in style." },
  { name: "Pet Coupon", slug: "pet-coupon", price: 200000, comparePrice: 240000, unit: "pc", stock: 60, minStock: 5, badge: "BEST_SELLER", categorySlug: "insane-dn", featured: true, description: "Pet Coupon for Dragon Nest. Summon a loyal companion that assists you in battle and boosts your stats." },
  { name: "Spirit Coupon", slug: "spirit-coupon", price: 220000, comparePrice: 265000, unit: "pc", stock: 70, minStock: 8, badge: "NEW", categorySlug: "insane-dn", featured: true, description: "Spirit Coupon for Dragon Nest Insane. Unlock a powerful spirit guardian that enhances your abilities." },
  { name: "DNP", slug: "dnp", price: 50000, comparePrice: null, unit: "pc", stock: 500, minStock: 50, badge: "BEST_SELLER", categorySlug: "insane-dn", featured: false, description: "Dragon Nest Points (DNP). The standard in-game currency used for purchasing items, upgrades, and services." },
  { name: "Gold Currency", slug: "gold-currency", price: 75000, comparePrice: null, unit: "pc", stock: 999, minStock: 100, badge: null, categorySlug: "insane-dn", featured: false, description: "Gold Currency for Dragon Nest Insane. Essential for trading, crafting, and unlocking premium in-game content." },
  { name: "LEIZ STORE", slug: "leiz-store-bundle", price: 500000, comparePrice: 650000, unit: "bundle", stock: 30, minStock: 5, badge: "LIMITED", categorySlug: "insane-dn", featured: true, description: "The exclusive LEIZ STORE bundle for Dragon Nest Insane. A curated package of our best items hand-picked for the ultimate DN experience." },
];

const CUSTOMERS = [
  { name: "GamerPro123", email: "gamerpro@email.com", discord: "GamerPro123#0123" },
  { name: "ShadowKill", email: "shadowkill@email.com", discord: "ShadowKill#4567" },
  { name: "NexusGamer", email: "nexusgamer@email.com", discord: "NexusGamer#7890" },
  { name: "PhoenixRise", email: "phoenixrise@email.com", discord: "PhoenixRise#2345" },
  { name: "VoidWalker", email: "voidwalker@email.com", discord: "VoidWalker#6789" },
  { name: "BladeRunner", email: "bladerunner@email.com", discord: "BladeRunner#0134" },
  { name: "StormChaser", email: "stormchaser@email.com", discord: "StormChaser#5678" },
  { name: "CyberNinja", email: "cyberninja@email.com", discord: "CyberNinja#9012" },
];

const TESTIMONIALS = [
  { name: "GamerPro123", avatar: "GP", rating: 5, content: "Fast delivery and legit products! Got my Valorant VP in less than 5 minutes. Highly recommended!" },
  { name: "ProPlayer_AK", avatar: "PA", rating: 5, content: "Best game store I've found. The prices are fair and the customer service on Discord is amazing." },
  { name: "CasualGamer", avatar: "CG", rating: 4, content: "Bought a Genshin account here. Everything was as described and the transfer was smooth. Will buy again!" },
  { name: "EsportsFan", avatar: "EF", rating: 5, content: "Trusted seller for years. Always reliable and the QRIS payment makes everything so easy." },
  { name: "NightOwl", avatar: "NO", rating: 5, content: "Ordered ML Diamonds at 2 AM and got them in 3 minutes. 24/7 support is no joke here." },
  { name: "RetroGamer", avatar: "RG", rating: 4, content: "Great selection of gift cards. The Spotify Premium deal was too good to pass up." },
];

const FAQS = [
  { question: "How fast is the delivery?", answer: "Most digital products are delivered instantly or within 5 minutes. Accounts may take up to 30 minutes for verification and transfer.", sortOrder: 1 },
  { question: "What payment methods do you accept?", answer: "We accept QRIS, DANA, OVO, GoPay, and Bank Transfer. All payments are processed securely.", sortOrder: 2 },
  { question: "Is this safe and legit?", answer: "Yes! We are a verified seller with thousands of happy customers. All products are sourced legitimately and come with our guarantee.", sortOrder: 3 },
  { question: "What if I have issues with my purchase?", answer: "Contact our support team on Discord within 24 hours of purchase. We offer refunds for any issues with delivered products.", sortOrder: 4 },
  { question: "Do you offer bulk discounts?", answer: "Yes! Contact us on Discord for bulk orders and we'll provide special pricing for larger quantities.", sortOrder: 5 },
];

const SETTINGS = [
  { id: cuid(), key: "store_name", value: "LEIZ STORE", type: "text", group: "general" },
  { id: cuid(), key: "store_description", value: "Your trusted marketplace for premium game materials and digital goods.", type: "text", group: "general" },
  { id: cuid(), key: "discord_link", value: "https://discord.gg/leizstore", type: "url", group: "social" },
  { id: cuid(), key: "whatsapp_link", value: "https://wa.me/6281234567890", type: "url", group: "social" },
  { id: cuid(), key: "email", value: "support@leizstore.com", type: "text", group: "contact" },
  { id: cuid(), key: "currency", value: "IDR", type: "text", group: "payment" },
  { id: cuid(), key: "tax_rate", value: "0.11", type: "number", group: "payment" },
  { id: cuid(), key: "min_order_amount", value: "10000", type: "number", group: "payment" },
  { id: cuid(), key: "announcement", value: "🔥 Flash Sale: 20% off all Valorant VP this weekend! Use code LEIZ20", type: "text", group: "content" },
];

const ORDER_STATUSES = ["PENDING", "PAID", "PROCESSING", "COMPLETED", "CANCELLED"];
const PAYMENT_METHODS = ["qris", "dana", "ovo", "gopay", "bank_transfer"];
const CUSTOMER_NAMES = ["GamerPro123", "ShadowKill", "NexusGamer", "PhoenixRise", "VoidWalker", "BladeRunner", "StormChaser", "CyberNinja", "PixelHunter", "ThunderBolt"];
const IGN_NAMES = ["xProGamerx", "ShadowBlade99", "NexusForce", "PhoenixKing", "VoidReaper", "BladeMaster", "StormBreaker", "CyberWolf", "PixelSniper", "ThunderStrike"];

// ─── Main Seed Function ───────────────────────────────────────

function main() {
  console.log("🌱 Seeding LEIZ STORE JSON database...\n");

  // Clean existing data
  console.log("🗑️  Cleaning existing data...");
  const files = fs.readdirSync(DATA_DIR);
  for (const file of files) {
    if (file.endsWith(".json")) {
      fs.unlinkSync(path.join(DATA_DIR, file));
    }
  }

  // ─── Store ────────────────────────────────────────────────
  console.log("🏪 Creating store...");
  const storeId = cuid();
  const store = {
    id: storeId,
    name: "LEIZ STORE",
    slug: "leiz-store",
    description: "Premium Game Materials Marketplace",
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  writeJson("store.json", [store]);

  // ─── Users ────────────────────────────────────────────────
  console.log("👥 Creating users...");
  const customerPassword = hashPassword("customer123");

  const users: any[] = [];

  const customerIds: string[] = [];
  for (const c of CUSTOMERS) {
    const customerId = cuid();
    customerIds.push(customerId);
    users.push({
      id: customerId,
      email: c.email,
      password: customerPassword,
      name: c.name,
      role: "CUSTOMER",
      discord: c.discord,
      isActive: true,
      lastLoginAt: randomDate(7).toISOString(),
      storeId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  writeJson("user.json", users);

  // ─── Categories ───────────────────────────────────────────
  console.log("📂 Creating categories...");
  // Update storeId for categories
  const categoriesWithStore = CATEGORIES.map((c) => ({ ...c, storeId }));
  writeJson("category.json", categoriesWithStore);

  // ─── Products ─────────────────────────────────────────────
  console.log("📦 Creating products...");
  const products: any[] = [];
  const productImages: any[] = [];
  const inventoryLogs: any[] = [];

  for (const p of PRODUCTS_DATA) {
    const category = categoriesWithStore.find((c) => c.slug === p.categorySlug);
    if (!category) continue;

    const productId = cuid();
    const priceUSD = Math.round(p.price * 0.000063 * 100) / 100;

    products.push({
      id: productId,
      name: p.name,
      slug: p.slug,
      description: p.description,
      price: p.price,
      priceUSD,
      comparePrice: p.comparePrice || null,
      comparePriceUSD: p.comparePrice ? Math.round(p.comparePrice * 0.000063 * 100) / 100 : null,
      unit: p.unit,
      stock: p.stock,
      minStock: p.minStock,
      badge: p.badge || null,
      isActive: true,
      isFeatured: p.featured,
      tags: p.categorySlug,
      categoryId: category.id,
      storeId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    productImages.push({
      id: cuid(),
      productId,
      url: `https://placehold.co/400x400/7C3AED/FFFFFF?text=${encodeURIComponent(p.name.split(" ").slice(0, 2).join("+"))}`,
      alt: p.name,
      sortOrder: 0,
    });

    inventoryLogs.push({
      id: cuid(),
      productId,
      change: p.stock,
      previousStock: 0,
      newStock: p.stock,
      reason: "SEED",
      reference: "Initial seed",
      createdAt: new Date().toISOString(),
    });
  }

  writeJson("product.json", products);
  writeJson("productImage.json", productImages);
  writeJson("inventoryLog.json", inventoryLogs);

  // ─── Orders & Payments ────────────────────────────────────
  console.log("🛒 Creating orders...");
  const orders: any[] = [];
  const orderItems: any[] = [];
  const payments: any[] = [];
  const activityLogs: any[] = [];
  const analyticsEvents: any[] = [];
  const orderCount = 30;

  for (let i = 0; i < orderCount; i++) {
    const daysAgo = Math.floor(Math.random() * 30);
    const orderDate = randomDate(daysAgo);
    const customer = CUSTOMER_NAMES[Math.floor(Math.random() * CUSTOMER_NAMES.length)];
    const ign = IGN_NAMES[Math.floor(Math.random() * IGN_NAMES.length)];
    const paymentMethod = PAYMENT_METHODS[Math.floor(Math.random() * PAYMENT_METHODS.length)];

    // Pick 1-2 random products
    const itemCount = 1 + Math.floor(Math.random() * 2);
    const selectedProducts: any[] = [];
    const usedIndices = new Set<number>();
    for (let j = 0; j < itemCount; j++) {
      let idx: number;
      do { idx = Math.floor(Math.random() * products.length); } while (usedIndices.has(idx));
      usedIndices.add(idx);
      selectedProducts.push(products[idx]);
    }

    let subtotal = 0;
    const items = selectedProducts.map((sp) => {
      const quantity = 1 + Math.floor(Math.random() * 2);
      const itemTotal = sp.price * quantity;
      subtotal += itemTotal;
      return {
        productId: sp.id,
        name: sp.name,
        price: sp.price,
        priceUSD: sp.priceUSD,
        quantity,
        total: itemTotal,
        totalUSD: sp.priceUSD ? sp.priceUSD * quantity : null,
      };
    });

    const tax = Math.round(subtotal * 0.11);
    const total = subtotal + tax;

    // Random status
    const statusRoll = Math.random();
    let status: string;
    if (statusRoll < 0.1) status = "PENDING";
    else if (statusRoll < 0.2) status = "WAITING_PAYMENT";
    else if (statusRoll < 0.35) status = "PAID";
    else if (statusRoll < 0.45) status = "PROCESSING";
    else if (statusRoll < 0.85) status = "COMPLETED";
    else if (statusRoll < 0.95) status = "CANCELLED";
    else status = "REFUNDED";

    const orderId = cuid();
    orders.push({
      id: orderId,
      orderNumber: generateOrderNumber(orderDate, i),
      status,
      customerName: customer,
      customerEmail: `${customer.toLowerCase()}@email.com`,
      customerDiscord: `${customer}#${Math.floor(1000 + Math.random() * 9000)}`,
      customerIGN: ign,
      subtotal,
      subtotalUSD: Math.round(subtotal * 0.000063 * 100) / 100,
      tax,
      taxUSD: Math.round(tax * 0.000063 * 100) / 100,
      total,
      totalUSD: Math.round(total * 0.000063 * 100) / 100,
      currency: "IDR",
      paymentMethod,
      paidAt: ["PAID", "PROCESSING", "COMPLETED"].includes(status) ? orderDate.toISOString() : null,
      completedAt: status === "COMPLETED" ? new Date(orderDate.getTime() + Math.random() * 3600000 * 2).toISOString() : null,
      storeId,
      createdAt: orderDate.toISOString(),
      updatedAt: orderDate.toISOString(),
    });

    // Order items
    for (const item of items) {
      orderItems.push({
        id: cuid(),
        orderId,
        ...item,
        totalUSD: item.totalUSD || null,
      });
    }

    // Payment for paid/completed orders
    if (["PAID", "PROCESSING", "COMPLETED"].includes(status)) {
      payments.push({
        id: cuid(),
        orderId,
        method: paymentMethod,
        amount: total,
        amountUSD: Math.round(total * 0.000063 * 100) / 100,
        currency: "IDR",
        status: status === "COMPLETED" ? "VERIFIED" : "PAID",
        paidAt: orderDate.toISOString(),
        verifiedAt: status === "COMPLETED" ? orderDate.toISOString() : null,
        createdAt: orderDate.toISOString(),
        updatedAt: orderDate.toISOString(),
      });
    }

    // Activity log
    activityLogs.push({
      id: cuid(),
      userId: customerIds[Math.floor(Math.random() * customerIds.length)],
      action: "ORDER_CREATED",
      entity: "order",
      entityId: orderId,
      details: JSON.stringify({ orderNumber: orders[orders.length - 1].orderNumber, total, paymentMethod }),
      createdAt: orderDate.toISOString(),
    });

    // Analytics event
    analyticsEvents.push({
      id: cuid(),
      event: "order_created",
      entity: "order",
      entityId: orderId,
      metadata: JSON.stringify({ total, itemCount: items.length }),
      storeId,
      createdAt: orderDate.toISOString(),
    });
  }

  writeJson("order.json", orders);
  writeJson("orderItem.json", orderItems);
  writeJson("payment.json", payments);
  writeJson("activityLog.json", activityLogs);
  writeJson("analyticsEvent.json", analyticsEvents);

  // ─── Testimonials ─────────────────────────────────────────
  console.log("💬 Creating testimonials...");
  const testimonials = TESTIMONIALS.map((t, i) => ({
    id: cuid(),
    ...t,
    isActive: true,
    sortOrder: i + 1,
    createdAt: new Date().toISOString(),
  }));
  writeJson("testimonial.json", testimonials);

  // ─── FAQs ─────────────────────────────────────────────────
  console.log("❓ Creating FAQs...");
  const faqs = FAQS.map((f) => ({
    id: cuid(),
    ...f,
    category: "general",
    isActive: true,
    createdAt: new Date().toISOString(),
  }));
  writeJson("faq.json", faqs);

  // ─── Settings ─────────────────────────────────────────────
  console.log("⚙️  Creating settings...");
  writeJson("setting.json", SETTINGS);

  // ─── Currency Rates ───────────────────────────────────────
  console.log("💱 Creating currency rates...");
  const currencyRates = [
    { id: "USD_IDR", from: "USD", to: "IDR", rate: 15800, source: "seed", updatedAt: new Date().toISOString() },
    { id: "IDR_USD", from: "IDR", to: "USD", rate: 0.000063, source: "seed", updatedAt: new Date().toISOString() },
  ];
  writeJson("currencyRate.json", currencyRates);

  // ─── Empty collections ────────────────────────────────────
  writeJson("refreshToken.json", []);
  writeJson("salesForecast.json", []);
  writeJson("customerSegment.json", []);
  writeJson("productRecommendation.json", []);
  writeJson("stockAlert.json", []);
  writeJson("notification.json", []);
  writeJson("banner.json", []);
  writeJson("wishlist.json", []);

  // ─── Summary ──────────────────────────────────────────────
  console.log("\n🎉 Seed completed successfully!\n");
  console.log("┌─────────────────────────────────────────┐");
  console.log("│  LEIZ STORE - Seed Summary               │");
  console.log("├─────────────────────────────────────────┤");
  console.log(`│  👤 Users:      ${String(users.length).padStart(5)}                  │`);
  console.log(`│  📂 Categories: ${String(categoriesWithStore.length).padStart(5)}                  │`);
  console.log(`│  📦 Products:   ${String(products.length).padStart(5)}                  │`);
  console.log(`│  🛒 Orders:     ${String(orderCount).padStart(5)}                  │`);
  console.log(`│  💬 Testimonials: ${String(testimonials.length).padStart(3)}                │`);
  console.log(`│  ❓ FAQs:       ${String(faqs.length).padStart(5)}                  │`);
  console.log("└─────────────────────────────────────────┘");
  console.log("\n🔑 Customer Login: gamerpro@email.com / customer123\n");
}

main();
