# 🛒 LEIZ STORE — Premium Game Materials Marketplace

<div align="center">

**Marketplace digital terpercaya untuk game currencies, materials, dan jasa service Dragon Nest Insane DN**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat&logo=supabase)](https://supabase.com/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4-38BDF8?style=flat&logo=tailwindcss)](https://tailwindcss.com/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-000?style=flat&logo=vercel)](https://vercel.com/)

</div>

---

## 📋 Daftar Isi

- [Tech Stack](#-tech-stack)
- [Fitur](#-fitur)
- [Katalog Produk](#-katalog-produk)
- [Prasyarat](#-prasyarat)
- [Panduan Memulai](#-panduan-memulai)
- [Variabel Lingkungan](#-variabel-lingkungan)
- [Panel Admin](#-panel-admin)
- [Arsitektur Database](#-arsitektur-database)
- [Struktur Proyek](#-struktur-proyek)
- [API Reference](#-api-reference)
- [Deployment ke Vercel](#-deployment-ke-vercel)
- [Perintah CLI](#-perintah-cli)
- [Troubleshooting](#-troubleshooting)
- [Lisensi](#-lisensi)

---

## 🚀 Tech Stack

| Layer | Teknologi |
|-------|-----------|
| **Framework** | Next.js 16 (App Router), React 19 |
| **Bahasa** | TypeScript 5 (strict mode) |
| **Styling** | TailwindCSS 4, Framer Motion 12 |
| **Database** | Supabase (PostgreSQL) |
| **State Management** | Zustand 5 |
| **Auth** | Supabase Auth + JWT |
| **Forms** | React Hook Form + Zod 4 |
| **Icons** | Lucide React |
| **Testing** | Jest + Testing Library (unit), Playwright (E2E) |
| **Deployment** | Vercel (serverless), Docker (opsional) |
| **PWA** | Service Worker, Offline Support, Manifest |

---

## ✨ Fitur

### 🛍️ Customer Features

| Fitur | Deskripsi |
|-------|-----------|
| **Katalog Produk** | Browse produk dengan filter kategori, search, dan sort |
| **Detail Produk** | Halaman detail dengan informasi lengkap, stok, dan harga |
| **Keranjang Belanja** | Drawer keranjang yang persistent dengan kalkulasi otomatis |
| **Checkout 4 Langkah** | Info Customer → Review Order → Pembayaran → Konfirmasi |
| **Wishlist** | Simpan produk favorit untuk dibeli nanti |
| **Tracking Pesanan** | Lacak status pesanan dengan nomor order |
| **Pembayaran** | QRIS, DANA, OVO, GoPay, Bank Transfer |
| **Responsive Design** | Tampilan optimal di semua perangkat (mobile, tablet, desktop) |
| **PWA Support** | Install sebagai app, offline page, service worker |
| **Animasi** | Transisi halus dengan Framer Motion |

### 🔧 Admin Panel

| Fitur | Deskripsi |
|-------|-----------|
| **Dashboard** | Ringkasan toko (total produk, pesanan, pendapatan, stok menipis) |
| **Manajemen Produk** | CRUD produk (tambah, edit, hapus, toggle aktif/nonaktif) |
| **Manajemen Kategori** | CRUD kategori produk |
| **Manajemen Pesanan** | Lihat daftar pesanan, update status (PENDING → PAID → PROCESSING → COMPLETED) |
| **Manajemen Pengguna** | Lihat daftar customer |
| **Pengaturan** | Konfigurasi toko (link Discord, WhatsApp, currency, dll) |
| **Real-time Updates** | Dashboard otomatis refresh saat ada perubahan data |
| **Stok Alerts** | Notifikasi stok menipis langsung di dashboard |

---

## 📦 Katalog Produk

### ⚔️ Service Runs

| Produk | Harga | Minimum |
|--------|-------|---------|
| **FABN** (Reroll Additional Skill on Jade) | Rp1.500/run | 10 runs |
| **FTKN** (Reroll Additional Effect on Rune) | Rp2.000/run | 10 runs |
| **Forest Dragon (T14)** | Rp2.000/run | 10 runs |
| **Rune Dragon (T14)** | Rp2.000/run | 10 runs |

### 📦 General

| Produk | Harga | Minimum |
|--------|-------|---------|
| **1 Stack Jade Dust** | Rp40.000/stack | 1 |
| **30 Stack Jade Dust** | Rp35.000/stack | 1 |
| **Balkov** | Rp300/pcs | 100 pcs |

### ⏳ On Progress (Pre-Order)

| Produk | Harga | Catatan |
|--------|-------|---------|
| **Conve T12 +99** | Rp70.000/pcs | Pre-Order = Lebih murah / Diskon |
| **Jade T12 +99** | Rp50.000/pcs | Pre-Order = Lebih murah / Diskon |
| **Hon Moguro** | Rp2.000/pcs | Pre-Order Rp1.500/pcs |

### 💰 Currency

| Produk | Harga | Minimum |
|--------|-------|---------|
| **Gold** | Rp800/1M gold | 10M gold |
| **Gold (Bulk)** | Rp70.000/100M gold | 100M gold |
| **DNP** | Rp40.000/1M DNP | 1M DNP |

---

## 📋 Prasyarat

- **Node.js 20+** — [Download](https://nodejs.org/)
- **npm** — Sudah termasuk dengan Node.js
- **Akun Supabase** — [Daftar gratis](https://supabase.com/) (Free tier sudah cukup)
- **Akun Vercel** — [Daftar gratis](https://vercel.com/) (Untuk deployment)

---

## 🛠️ Panduan Memulai

### Step 1 — Clone & Install

```bash
git clone https://github.com/29nls/leiz-store.git
cd leiz-store
npm install
```

### Step 2 — Konfigurasi Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` dengan kredensial Supabase Anda:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
JWT_SECRET=your-random-secret-here
```

### Step 3 — Setup Database

1. Buat project baru di [Supabase Dashboard](https://supabase.com/dashboard)
2. Copy kredensial dari **Settings → API**
3. Buka **SQL Editor** dan jalankan script dari `scripts/supabase-schema.sql`
4. Jalankan script seeder untuk mengisi data awal:

```bash
npx tsx scripts/create-admin.ts
```

### Step 4 — Jalankan Development Server

```bash
npm run dev
```

Buka **[http://localhost:3000](http://localhost:3000)** di browser.

### Step 5 — Login Admin

Buka **[http://localhost:3000/admin/login](http://localhost:3000/admin/login)**

| Email | Password |
|-------|----------|
| `admin@leizstore.com` | `admin123` |

---

## 🔐 Variabel Lingkungan

| Variabel | Wajib | Deskripsi |
|----------|-------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | URL project Supabase (Settings → API) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Anon/public key Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service role key (admin operations) |
| `JWT_SECRET` | ✅ | Secret key untuk JWT (ubah di production!) |
| `NEXT_PUBLIC_SITE_URL` | ❌ | URL publik (default: `http://localhost:3000`) |

### Opsional — Notifikasi

| Variabel | Deskripsi |
|----------|-----------|
| `TELEGRAM_BOT_TOKEN` | Bot token Telegram untuk notifikasi order |
| `TELEGRAM_CHAT_ID` | Chat ID Telegram tujuan notifikasi |
| `DISCORD_WEBHOOK_URL` | Webhook URL Discord untuk notifikasi |
| `WHATSAPP_API_KEY` | API key WhatsApp Gateway |
| `WHATSAPP_API_URL` | URL API WhatsApp Gateway |

### Opsional — Pembayaran

| Variabel | Deskripsi |
|----------|-----------|
| `QRIS_WEBHOOK_SECRET` | Secret key untuk callback QRIS payment |

---

## 🔧 Panel Admin

Akses panel admin di **`/admin`** setelah login.

### Struktur Menu

| Menu | Path | Deskripsi |
|------|------|-----------|
| **Dashboard** | `/admin` | Ringkasan statistik toko, pesanan terbaru, stok menipis |
| **Produk** | `/admin/products` | CRUD produk, toggle aktif/nonaktif, filter kategori |
| **Kategori** | `/admin/categories` | CRUD kategori, urutan tampilan |
| **Pesanan** | `/admin/orders` | Daftar pesanan, update status, detail pesanan |
| **Pengguna** | `/admin/users` | Daftar customer |
| **Pengaturan** | `/admin/settings` | Konfigurasi toko, link sosial |

### Status Pesanan

```
PENDING → PAID → PROCESSING → COMPLETED
                                    ↓
                               CANCELLED
```

---

## 💾 Arsitektur Database

Proyek ini menggunakan **Supabase (PostgreSQL)** sebagai database. Data diakses melalui adapter kustom yang menyediakan API Prisma-compatible.

### Model Data

```
store (1) ──→ product (N)
store (1) ──→ category (N)
store (1) ──→ order (N)
store (1) ──→ user (N)

category (1) ──→ product (N)
category (1) ──→ parent (self-ref)

product (1) ──→ order_item (N)
product (1) ──→ product_image (N)
product (1) ──→ inventory_log (N)
product (1) ──→ stock_alert (N)
product (1) ──→ wishlist (N)

order (1) ──→ order_item (N)
order (1) ──→ payment (1)

user (1) ──→ order (N)
user (1) ──→ activity_log (N)
user (1) ──→ customer_segment (N)
```

### Database Adapter

File: `src/lib/supabase-db.ts`

Adapter ini menyediakan API Prisma-compatible:

```typescript
// Query examples
const products = await prisma.product.findMany({
  where: { isActive: true, category: { slug: "insane-dn" } },
  include: { category: true, images: true },
  orderBy: { createdAt: "desc" },
  take: 20,
});

const order = await prisma.order.create({
  data: { ... },
  include: { items: true },
});

const stats = await prisma.order.aggregate({
  _sum: { total: true },
  _count: { id: true },
  where: { status: { in: ["PAID", "COMPLETED"] } },
});
```

**Operasi yang didukung:**
- `findMany`, `findUnique`, `findFirst`
- `create`, `createMany`, `upsert`
- `update`, `updateMany`
- `delete`, `deleteMany`
- `count`, `aggregate`, `groupBy`
- `$transaction` (sequential execution)
- Relasi (include nested models)
- Filter: `equals`, `contains`, `in`, `gt`, `gte`, `lt`, `lte`, `startsWith`, `endsWith`

---

## 📁 Struktur Proyek

```
leiz-store/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # Root layout (fonts, metadata, PWA)
│   │   ├── page.tsx                  # Homepage
│   │   ├── globals.css               # Global styles & Tailwind
│   │   ├── admin/                    # Admin panel (10 halaman)
│   │   │   ├── page.tsx              # Dashboard
│   │   │   ├── layout.tsx            # Admin layout + AuthGuard
│   │   │   ├── AdminShell.tsx        # Sidebar + header shell
│   │   │   ├── login/page.tsx        # Admin login
│   │   │   ├── products/page.tsx     # CRUD produk
│   │   │   ├── categories/page.tsx   # CRUD kategori
│   │   │   ├── orders/page.tsx       # Daftar pesanan
│   │   │   ├── orders/[id]/page.tsx  # Detail pesanan
│   │   │   ├── users/page.tsx        # Daftar user
│   │   │   └── settings/page.tsx     # Pengaturan toko
│   │   ├── products/                 # Halaman publik produk
│   │   │   ├── page.tsx              # Katalog produk
│   │   │   └── [slug]/page.tsx       # Detail produk
│   │   ├── checkout/page.tsx         # Checkout 4 langkah
│   │   ├── track/page.tsx            # Tracking pesanan
│   │   ├── wishlist/page.tsx         # Wishlist
│   │   └── api/                      # REST API routes
│   │       ├── admin/                # Admin API (CRUD)
│   │       ├── products/             # Public produk API
│   │       ├── orders/               # Order API + tracking
│   │       ├── payments/             # QRIS callback
│   │       └── health/               # Health check endpoint
│   ├── components/                   # React komponen
│   │   ├── layout/                   # Navbar, Footer, LivePurchaseTicker
│   │   ├── product/                  # ProductCard, ProductFilters
│   │   ├── cart/                     # CartDrawer
│   │   ├── performance/              # LazySection, OptimizedImage, ResourceHints
│   │   └── ui/                       # Animated, Icons
│   ├── lib/                          # Utility libraries
│   │   ├── supabase-db.ts            # Database adapter (Prisma API)
│   │   ├── supabase.ts               # Server Supabase client
│   │   ├── supabase-browser.ts       # Client Supabase + Realtime
│   │   ├── admin-auth.ts             # Admin auth helper
│   │   ├── auth.ts                   # JWT helpers
│   │   ├── currency.ts               # IDR/USD converter
│   │   ├── prisma-types.ts           # TypeScript type definitions
│   │   ├── repositories/             # Data access layer
│   │   ├── services/                 # Business logic layer
│   │   ├── errors.ts                 # Custom error classes
│   │   ├── notifications.ts          # Multi-channel notifications
│   │   ├── qris.ts                   # QRIS payment integration
│   │   ├── i18n.ts                   # Internationalization
│   │   ├── middleware.ts             # Next.js middleware
│   │   ├── fonts.tsx                 # Font configuration
│   │   ├── motion.tsx                # Framer Motion variants
│   │   ├── db.ts                     # Database re-export
│   │   ├── storage.ts                # Storage helpers
│   │   └── utils.ts                  # Utility functions
│   ├── stores/                       # Zustand state
│   │   ├── cart-store.ts             # Cart state & calculations
│   │   ├── locale-store.ts           # Locale preferences
│   │   └── theme-store.ts            # Theme management
│   ├── styles/                       # CSS files
│   │   └── performance-animations.css
│   ├── types/                        # TypeScript types
│   ├── hooks/                        # Custom React hooks
│   └── data/                         # Static data fallback
├── public/                           # Static assets
│   ├── manifest.json                 # PWA manifest
│   ├── sw-template.js                # Service Worker template
│   ├── offline.html                  # Offline fallback page
│   ├── _headers                      # Cloudflare headers
│   └── _redirects                    # Cloudflare redirects
├── scripts/                          # Utility scripts
│   ├── create-admin.ts               # Create admin user
│   ├── supabase-schema.sql           # Database schema SQL
│   ├── seed-products.ts              # Seed product data
│   └── update-products.ts            # Update product data
├── e2e/                              # Playwright E2E tests
│   └── smoke.spec.ts
├── next.config.ts                    # Next.js configuration
├── vercel.json                       # Vercel configuration
├── tsconfig.json                     # TypeScript configuration├── postcss.config.mjs                # PostCSS / TailwindCSS 4 configuration
└── .env.example                      # Environment variables template
```

---

## 🌐 API Reference

### Public API

| Endpoint | Method | Deskripsi |
|----------|--------|-----------|
| `/api/products` | GET | Daftar produk (pagination, filter, search) |
| `/api/products/[slug]` | GET | Detail produk by slug |
| `/api/orders` | POST | Buat pesanan baru |
| `/api/orders/track` | GET | Tracking pesanan by nomor order |
| `/api/payments/qris/callback` | POST | Callback pembayaran QRIS |
| `/api/health` | GET | Health check server & database |

### Admin API (Authenticated)

| Endpoint | Method | Deskripsi |
|----------|--------|-----------|
| `/api/admin/login` | POST | Login admin |
| `/api/admin/verify` | GET | Verify session admin |
| `/api/admin/logout` | POST | Logout admin |
| `/api/admin/products` | GET | Daftar semua produk (admin) |
| `/api/admin/products/[id]` | GET/PUT/DELETE | Detail, update, hapus produk |
| `/api/admin/categories` | GET/POST | Daftar/tambah kategori |
| `/api/admin/categories/[id]` | GET/PUT/DELETE | Detail, update, hapus kategori |
| `/api/admin/orders` | GET | Daftar semua pesanan |
| `/api/admin/orders/[id]` | GET | Detail pesanan |
| `/api/admin/users` | GET | Daftar pengguna |
| `/api/admin/stats` | GET | Statistik dashboard |
| `/api/admin/settings` | GET/PUT | Pengaturan toko |

---

## 🚀 Deployment ke Vercel

### Automatic Deployment (GitHub)

1. **Push code ke GitHub** (lihat panduan di atas)
2. **Buat akun Vercel** di [vercel.com](https://vercel.com/)
3. **Import repository** dari GitHub:
   - Klik **Add New → Project**
   - Pilih repository `leiz-store`
   - Framework sudah terdeteksi sebagai **Next.js**
4. **Add Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `JWT_SECRET`
   - `NEXT_PUBLIC_SITE_URL` → Set ke domain Vercel Anda
5. **Deploy!** 🚀

### Manual Deployment (Vercel CLI)

```bash
# Install Vercel CLI
npm i -g vercel

# Login ke Vercel
vercel login

# Deploy
vercel --prod
```

### Konfigurasi Vercel

File `vercel.json` sudah dikonfigurasi dengan:
- ✅ Framework: Next.js
- ✅ Security headers (CSP, HSTS, XSS Protection)
- ✅ Cache optimization (static assets, API)
- ✅ Redirects (/shop → /products, /cart → /checkout)
- ✅ Region: Singapore (sin1) — optimal untuk Asia Tenggara
- ✅ Compression: gzip/brotli

### PWA di Production

Setelah deploy, pastikan:
- ✅ Masukkan environment variables di Vercel Dashboard
- ✅ Domain sudah dikonfigurasi (custom domain optional)
- ✅ Service worker akan otomatis register di production

---

## 📦 Perintah CLI

### Development

```bash
npm run dev          # Start development server (localhost:3000)
npm run build        # Build untuk production
npm start            # Start production server
npm run lint         # Run ESLint
npm run lint:fix     # Fix lint issues otomatis
npm run typecheck    # TypeScript type checking
```

### Testing

```bash
npm test             # Run unit tests (Jest)
npm run test:watch   # Watch mode
npm run test:coverage # Coverage report
npm run e2e          # Run E2E tests (Playwright)
npm run e2e:ui       # E2E dengan UI mode
```

### Performance

```bash
npm run analyze       # Analyze bundle size
npm run optimize      # Optimize bundle
npm run perf          # Build + analyze + lighthouse
npm run dedupe        # Deduplicate dependencies
```

### Scripts

```bash
npx tsx scripts/create-admin.ts    # Buat admin user di Supabase
npx tsx scripts/seed-products.ts   # Seed data produk
npx tsx scripts/update-products.ts # Update data produk
```

---

## ⚠️ Troubleshooting

### Port 3000 sudah terpakai

```bash
# Cari PID yang menggunakan port 3000
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Atau Next.js akan otomatis cari port berikutnya
```

### Database Error

```bash
# Cek koneksi Supabase
curl http://localhost:3000/api/health

# Pastikan environment variables benar
cat .env.local

# Cek schema sudah diapply di Supabase SQL Editor
```

### Build Error

```bash
# Hapus cache dan rebuild
rm -rf .next
npm run build
```

### TypeScript Error

```bash
npm run typecheck
npm install  # Pastikan semua dependencies terinstall
```

### Data Tidak Muncul

- Pastikan table sudah dibuat di Supabase (jalankan `scripts/supabase-schema.sql`)
- Pastikan data sudah di-seed dengan script yang sesuai
- Cek console browser untuk error network

---

## 📜 Lisensi

Proyek ini dilisensikan di bawah **MIT License** — lihat file [LICENSE](LICENSE) untuk detail.

---

<div align="center">
  <strong>Dibuat dengan ❤️ oleh LEIZ STORE</strong>
  <br/>
  <sub>Dragon Nest Insane DN — Premium Game Materials Marketplace</sub>
  <br/>
  <a href="https://leizstore.com">Website</a> •
  <a href="https://discord.gg/leizstore">Discord</a> •
  <a href="https://wa.me/6281234567890">WhatsApp</a>
</div>
