/**
 * LEIZ STORE - Product & Category Seeder
 * 
 * Deletes all existing products/categories and creates new ones
 * based on the latest product catalog.
 * 
 * Usage: npx tsx scripts/seed-products.ts
 * 
 * Prerequisites:
 * - .env with NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 *   and SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// ─── Config ──────────────────────────────────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function generateId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 25);
}

const now = new Date().toISOString();

// ─── Categories ──────────────────────────────────────────────

interface CategoryData {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const CATEGORIES: CategoryData[] = [
  {
    id: generateId(),
    name: "Service Runs",
    slug: "service-runs",
    description: "Jasa run dungeon & reroll equipment",
    icon: "⚔️",
    sort_order: 1,
    is_active: true,
    created_at: now,
    updated_at: now,
  },
  {
    id: generateId(),
    name: "General",
    slug: "general",
    description: "Item dan material umum",
    icon: "📦",
    sort_order: 2,
    is_active: true,
    created_at: now,
    updated_at: now,
  },
  {
    id: generateId(),
    name: "On Progress",
    slug: "on-progress",
    description: "Pre-order items dengan harga spesial",
    icon: "⏳",
    sort_order: 3,
    is_active: true,
    created_at: now,
    updated_at: now,
  },
  {
    id: generateId(),
    name: "Currency",
    slug: "currency",
    description: "In-game currency dan points",
    icon: "💰",
    sort_order: 4,
    is_active: true,
    created_at: now,
    updated_at: now,
  },
];

// ─── Products ────────────────────────────────────────────────

interface ProductData {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  unit: string;
  stock: number;
  min_stock: number;
  badge: string | null;
  is_active: boolean;
  is_featured: boolean;
  category_id: string;
  created_at: string;
  updated_at: string;
}

interface ProductImageData {
  id: string;
  product_id: string;
  url: string;
  alt: string;
  sort_order: number;
}

function buildProducts(categories: CategoryData[]): {
  products: ProductData[];
  images: ProductImageData[];
} {
  const getCatId = (slug: string) =>
    categories.find((c) => c.slug === slug)!.id;

  const products: ProductData[] = [];
  const images: ProductImageData[] = [];

  const addProduct = (
    name: string,
    slug: string,
    price: number,
    unit: string,
    stock: number,
    minStock: number,
    categorySlug: string,
    badge: string | null,
    desc: string,
    featured = false
  ) => {
    const id = generateId();
    products.push({
      id,
      name,
      slug,
      description: desc,
      price,
      unit,
      stock,
      min_stock: minStock,
      badge,
      is_active: true,
      is_featured: featured,
      category_id: getCatId(categorySlug),
      created_at: now,
      updated_at: now,
    });

    // Add placeholder image
    const imgLabel = encodeURIComponent(name.split(" ").slice(0, 2).join("+"));
    images.push({
      id: generateId(),
      product_id: id,
      url: `https://placehold.co/400x400/7C3AED/FFFFFF?text=${imgLabel}`,
      alt: name,
      sort_order: 0,
    });
  };

  // ── Kategori: Service Runs ──
  addProduct(
    "FABN (Reroll Additional Skill on Jade)",
    "fabn-reroll-additional-skill-jade",
    1500,
    "run",
    9999,
    10,
    "service-runs",
    null,
    "Layanan reroll Additional Skill pada Jade. Minimum 10 run. Harga per run: Rp1.500",
    true
  );
  addProduct(
    "FTKN (Reroll Additional Effect on Rune)",
    "ftkn-reroll-additional-effect-rune",
    2000,
    "run",
    9999,
    10,
    "service-runs",
    null,
    "Layanan reroll Additional Effect pada Rune. Minimum 10 run. Harga per run: Rp2.000",
    true
  );
  addProduct(
    "Forest Dragon (T14)",
    "forest-dragon-t14",
    2000,
    "run",
    9999,
    10,
    "service-runs",
    "HOT",
    "Jasa run Forest Dragon (T14). Minimum 10 run. Harga per run: Rp2.000"
  );
  addProduct(
    "Rune Dragon (T14)",
    "rune-dragon-t14",
    2000,
    "run",
    9999,
    10,
    "service-runs",
    "HOT",
    "Jasa run Rune Dragon (T14). Minimum 10 run. Harga per run: Rp2.000"
  );

  // ── Kategori: General ──
  addProduct(
    "1 Stack Jade Dust",
    "1-stack-jade-dust",
    40000,
    "stack",
    999,
    10,
    "general",
    null,
    "1 stack Jade Dust. Harga: Rp40.000/stack"
  );
  addProduct(
    "1 Page / 30 Stack Jade Dust",
    "1-page-30-stack-jade-dust",
    35000,
    "page",
    999,
    5,
    "general",
    "BEST_SELLER",
    "1 page berisi 30 stack Jade Dust dengan harga lebih hemat. Harga: Rp35.000/stack",
    true
  );
  addProduct(
    "Balkov",
    "balkov",
    300,
    "pcs",
    99999,
    100,
    "general",
    "BEST_SELLER",
    "Balkov. Minimum pembelian 100 pcs. Harga: Rp300/pcs",
    true
  );

  // ── Kategori: On Progress ──
  addProduct(
    "Conve T12 +99",
    "conve-t12-99",
    70000,
    "pcs",
    50,
    5,
    "on-progress",
    "LIMITED",
    "Conversion T12 +99. Note: Pre-Order = More cheap / Got Discount. Harga: Rp70.000/pcs",
    true
  );
  addProduct(
    "Jade T12 +99",
    "jade-t12-99",
    50000,
    "pcs",
    50,
    5,
    "on-progress",
    "LIMITED",
    "Jade T12 +99. Note: Pre-Order = More cheap / Got Discount. Harga: Rp50.000/pcs",
    true
  );
  addProduct(
    "Hon Moguro",
    "hon-moguro",
    2000,
    "pcs",
    500,
    10,
    "on-progress",
    "LIMITED",
    "Hon Moguro. Pre-Order: Rp1.500/pcs. Harga normal: Rp2.000/pcs",
    true
  );

  // ── Kategori: Currency ──
  addProduct(
    "Gold (10M - 100M)",
    "gold-10m-100m",
    800,
    "M",
    999999,
    10,
    "currency",
    "BEST_SELLER",
    "Gold dengan harga 800 IDR/1M. Minimum pembelian 10M gold. Harga per 1M: Rp800",
    true
  );
  addProduct(
    "Gold (100M+)",
    "gold-100m-plus",
    700,
    "M",
    999999,
    100,
    "currency",
    null,
    "Gold dengan harga spesial 70.000 IDR/100M. Minimum pembelian 100M gold. Harga per 1M: Rp700"
  );
  addProduct(
    "DNP (Dragon Nest Points)",
    "dnp-dragon-nest-points",
    40000,
    "M",
    999999,
    1,
    "currency",
    "BEST_SELLER",
    "Dragon Nest Points (DNP). Minimum pembelian 1M DNP. Harga per 1M: Rp40.000",
    true
  );

  return { products, images };
}

// ─── Main ────────────────────────────────────────────────────

async function main() {
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║    LEIZ STORE — Product Seeder            ║");
  console.log("╚══════════════════════════════════════════╝\n");

  try {
    // Step 1: Delete existing data (order matters for FK constraints)
    console.log("1️⃣  Menghapus data lama...");

    const tables = [
      "product_image",
      "stock_alert",
      "inventory_log",
      "wishlist",
      "product_recommendation",
      "order_item",
      "product",
      "category",
    ];

    for (const table of tables) {
      const { error } = await supabase.from(table).delete().neq("id", "none");
      if (error && !error.message.includes("violates foreign key")) {
        console.log(`   ⚠️  ${table}: ${error.message}`);
      } else {
        console.log(`   ✅ ${table} cleared`);
      }
    }

    // Step 2: Create categories
    console.log("\n2️⃣  Membuat kategori baru...");
    const { error: catError } = await supabase.from("category").insert(CATEGORIES);
    if (catError) throw catError;
    console.log(`   ✅ ${CATEGORIES.length} kategori dibuat`);

    // Step 3: Build product data
    const { products, images } = buildProducts(CATEGORIES);
    console.log(`\n3️⃣  Menyiapkan ${products.length} produk...`);

    // Step 4: Create products
    console.log("\n4️⃣  Membuat produk...");
    const { error: prodError } = await supabase.from("product").insert(products);
    if (prodError) throw prodError;
    console.log(`   ✅ ${products.length} produk dibuat`);

    // Step 5: Create product images
    console.log("\n5️⃣  Membuat gambar produk...");
    const { error: imgError } = await supabase.from("product_image").insert(images);
    if (imgError) throw imgError;
    console.log(`   ✅ ${images.length} gambar produk dibuat`);

    // Summary
    console.log("\n╔══════════════════════════════════════════╗");
    console.log("║    ✅ SEEDING COMPLETE!                  ║");
    console.log("╚══════════════════════════════════════════╝");
    console.log(`\n📊 Summary:`);
    console.log(`   Kategori: ${CATEGORIES.length}`);
    console.log(`   Produk: ${products.length}`);
    console.log(`   Gambar: ${images.length}`);
    console.log("");
    console.log("   Kategori:");
    CATEGORIES.forEach((c) => {
      const count = products.filter((p) => p.category_id === c.id).length;
      console.log(`   • ${c.name} (${count} produk)`);
    });
    console.log("\n✅ Selesai! Restart server untuk melihat perubahan.\n");
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();
