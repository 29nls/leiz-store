import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "docs", "redesign", "before");
mkdirSync(OUT, { recursive: true });

const BASE = "http://localhost:3000";

const PAGES = [
  { path: "/",               name: "home"           },
  { path: "/products",        name: "items-grid"     },
  { path: "/products/dnp-mega-box", name: "product-detail" },
  { path: "/track",           name: "track-order"    },
  { path: "/wishlist",        name: "wishlist"       },
  { path: "/faq",             name: "faq"            },
  { path: "/auth/login",      name: "login"          },
  { path: "/checkout",        name: "checkout"       },
  { path: "/admin/login",     name: "admin-login"    },
  { path: "/admin",           name: "admin-dashboard" },
];

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

for (const { path, name } of PAGES) {
  const page = await ctx.newPage();
  try {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: true });
    console.log(`✓ ${name}`);
  } catch (e) {
    console.error(`✗ ${name}: ${e.message}`);
    // capture even on error
    try {
      await page.screenshot({ path: join(OUT, `${name}--error.png`), fullPage: true });
    } catch {}
  } finally {
    await page.close();
  }
}

await browser.close();
console.log(`\nDone → ${OUT}`);
