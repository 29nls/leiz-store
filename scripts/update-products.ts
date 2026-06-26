/**
 * LEIZ STORE - Update Product Details
 * 
 * Updates product names, slugs, units, and descriptions
 * to match the latest specifications.
 * 
 * Usage: npx tsx scripts/update-products.ts
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface ProductUpdate {
  id: string;
  name?: string;
  slug?: string;
  description?: string;
  price?: number;
  unit?: string;
  min_stock?: number;
}

async function main() {
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║    LEIZ STORE — Update Products          ║");
  console.log("╚══════════════════════════════════════════╝\n");

  try {
    // Get current categories
    const { data: categories } = await supabase
      .from("category")
      .select("id, name, slug");
    
    if (!categories) {
      console.error("❌ No categories found");
      process.exit(1);
    }

    const getCatId = (slug: string) => categories.find((c) => c.slug === slug)?.id;
    const getCatName = (slug: string) => categories.find((c) => c.slug === slug)?.name;

    // Get current products from Supabase directly
    const { data: products } = await supabase
      .from("product")
      .select("id, name, slug, category_id");

    if (!products || products.length === 0) {
      console.error("❌ No products found");
      process.exit(1);
    }

    console.log(`📦 Found ${products.length} products\n`);

    // ─── Define updates ──────────────────────────────────────
    
    interface UpdateDef {
      matchName: string;       // match by name fragment
      updates: ProductUpdate;
    }

    const updates: UpdateDef[] = [
      // ── Service Runs ──
      {
        matchName: "FABN",
        updates: {
          description: "FABN (Reroll Additional skill on jade) = 1500 IDR/run. Note: minimum 10 runs",
        },
      },
      {
        matchName: "FTKN",
        updates: {
          description: "FTKN (Reroll Additional effect on Rune) = 2000 IDR/run. Note: minimum 10 runs",
        },
      },
      {
        matchName: "Forest Dragon",
        updates: {
          description: "Forest Dragon (T14) = 2000 IDR/run. Note: minimum 10 runs",
        },
      },
      {
        matchName: "Rune Dragon",
        updates: {
          description: "Rune Dragon (T14) = 2000 IDR/run. Note: minimum 10 runs",
        },
      },

      // ── General ──
      {
        matchName: "1 Stack Jade Dust",
        updates: {
          description: "1 stack jade dust = 40000 IDR",
        },
      },
      {
        matchName: "1 Page / 30 Stack Jade Dust",
        updates: {
          name: "30 Stack Jade Dust",
          slug: "30-stack-jade-dust",
          unit: "stack",
          min_stock: 1,
          description: "30 stack jade dust = 35000 IDR. Harga per stack: Rp35.000",
        },
      },
      {
        matchName: "Balkov",
        updates: {
          description: "Balkov 300 IDR/pcs. Note: minimum 100 pcs",
        },
      },

      // ── On Progress ──
      {
        matchName: "Conve T12",
        updates: {
          description: "Conve T12 +99 = 70000 IDR/pcs. Note: Pre-Order = More cheap / Got Discount",
        },
      },
      {
        matchName: "Jade T12",
        updates: {
          description: "Jade T12+99 = 50000 IDR/pcs. Note: Pre-Order = More cheap / Got Discount",
        },
      },
      {
        matchName: "Hon Moguro",
        updates: {
          description: "Hon Moguro = 2000 IDR/pcs. Note: Pre-Order 1500 IDR/pcs",
        },
      },

      // ── Currency ──
      {
        matchName: "Gold (10M",
        updates: {
          name: "Gold",
          slug: "gold-800-1m",
          description: "Gold 800 IDR/1M gold. Note: Minimum 10m gold",
        },
      },
      {
        matchName: "Gold (100M",
        updates: {
          name: "Gold (Bulk)",
          slug: "gold-bulk-70k-100m",
          description: "Gold 70000 IDR/100000000 gold. Note: Minimum 100000000 gold",
        },
      },
      {
        matchName: "DNP",
        updates: {
          name: "DNP",
          slug: "dnp",
          description: "DNP 40000 IDR/1000000 DNP. Note: Minimum 1000000 DNP",
        },
      },
    ];

    // ─── Apply updates ──────────────────────────────────────
    
    let updated = 0;
    let skipped = 0;

    for (const updateDef of updates) {
      const product = products.find((p) =>
        p.name.toLowerCase().includes(updateDef.matchName.toLowerCase())
      );

      if (!product) {
        console.log(`   ⚠️  Product matching "${updateDef.matchName}" not found`);
        skipped++;
        continue;
      }

      const { error } = await supabase
        .from("product")
        .update({
          ...updateDef.updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", product.id);

      if (error) {
        console.log(`   ❌ ${product.name}: ${error.message}`);
      } else {
        console.log(`   ✅ ${product.name} → ${updateDef.updates.name || "(description updated)"}`);
        updated++;
      }
    }

    // ─── Summary ───────────────────────────────────────────
    console.log("\n╔══════════════════════════════════════════╗");
    console.log("║    ✅ UPDATE COMPLETE!                   ║");
    console.log("╚══════════════════════════════════════════╝");
    console.log(`\n📊 Summary:`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped: ${skipped}`);
    console.log("\n✅ Done! Restart server to see changes.\n");

  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();
