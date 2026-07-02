# 🛒 LEIZ STORE — knowledge.md

> **Project Context File — Auto-loaded by Codebuff setiap session.**
> File ini menyediakan konteks lengkap project untuk AI assistant tanpa perlu membaca seluruh codebase.

---

## 📋 Ringkasan Project

**LEIZ STORE** adalah marketplace premium untuk *game materials* Dragon Nest Insane (DN). Pelanggan dapat membeli item game seperti DNP, gold, pouches, dan coupons. Pembayaran dilakukan secara manual melalui Bank Transfer / GoPay / DANA / SeaBank dengan verifikasi admin via Discord.

| Metadata | Detail |
|----------|--------|
| **URL** | `https://leizstore.com` |
| **Stack** | Next.js 16 + Supabase + TailwindCSS 4 |
| **Deploy** | Vercel (serverless, region Singapore) |
| **Database** | Supabase PostgreSQL (25 tables) |
| **Auth** | Supabase Auth + JWT (HS256) |
| **Payment** | Manual (Bank Transfer, GoPay, DANA, SeaBank) via verifikasi Discord |
| **Delivery** | Discord DM setelah pembayaran dikonfirmasi admin |
| **State** | Zustand + persist middleware (localStorage) |
| **Analytics** | Vercel Web Analytics + Speed Insights |

---

## 🏗️ Arsitektur

### Layer Architecture

```
src/
├── app/               # Next.js App Router (pages & API routes)
│   ├── api/           # REST API endpoints
│   ├── admin/         # Admin panel (protected)
│   ├── checkout/      # Checkout flow (4 steps)
│   ├── payment/       # Payment instructions page
│   ├── products/      # Product catalog & detail
│   ├── track/         # Order tracking
│   └── wishlist/      # Wishlist
├── components/        # React components
│   ├── layout/        # Navbar, Footer, LivePurchaseTicker
│   ├── cart/          # CartDrawer
│   ├── product/       # ProductCard, ProductFilters
│   ├── performance/   # LazySection, OptimizedImage, ResourceHints
│   └── ui/            # Animated, Icons (re-exported Lucide)
├── lib/               # Utility libraries
│   ├── supabase-db.ts # Database adapter (Prisma-compatible API)
│   ├── repositories/  # Data access layer
│   ├── services/      # Business logic layer
│   ├── payment/       # Payment flow (constants, service, order-logger)
│   ├── discord/       # Discord bot & embed builders
│   └── ...
├── stores/            # Zustand state management (cart, theme, locale)
├── types/             # TypeScript type definitions
├── hooks/             # Custom React hooks (use-data)
├── data/              # Static data fallback (8 products)
└── styles/            # CSS files (performance-animations.css)
```

### Key Design Decisions

1. **Database Adapter**: `src/lib/supabase-db.ts` menyediakan API Prisma-compatible di atas Supabase REST API — pola repository/service seperti Prisma asli tanpa perlu Prisma Client.
2. **Manual Payment Flow**: Semua pembayaran diverifikasi manual oleh admin melalui Discord. Pelanggan transfer ke rekening, konfirmasi dengan upload bukti, admin verifikasi via Discord interaction buttons.
3. **Discord Bot Integration**: Admin memverifikasi pembayaran langsung dari Discord menggunakan komponen interaktif (buttons). Tidak perlu login ke admin panel. Webhook URL sebagai fallback.
4. **State Management**: Zustand dengan persist middleware untuk cart persistence. Cart disimpan di localStorage.
5. **Dual Currency**: Mendukung IDR (default) dan USD dengan auto-conversion via exchange rate API.
6. **Payment Expiry**: Setiap order memiliki expiry 24 jam. Cron job otomatis expire order overdue setiap hari jam 00:00 UTC.
7. **Performance**: Lazy loading (IntersectionObserver), OptimizedImage (blur placeholder), ResourceHints (preconnect/prefetch), Web Vitals reporting.

---

## 🗄️ Database Schema (Supabase PostgreSQL)

> File: `scripts/supabase-schema.sql`

**25 tables** dengan TEXT IDs untuk kompatibilitas JSON.

### Core Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `store` | Toko | id, name, slug, settings (JSONB) |
| `user` | Pengguna (customer & admin) | id, email, password, role, discord |
| `category` | Kategori produk | id, name, slug, parent_id (self-ref) |
| `product` | Produk digital | id, name, slug, price, stock, min_stock, badge, category_id |
| `product_image` | Gambar produk | id, product_id, url, sort_order |
| `order` | Pesanan | id, order_number, status, customer_name, total, payment_method, expiry_at |
| `order_item` | Item dalam pesanan | id, order_id, product_id, name, price, quantity |
| `payment` | Pembayaran | id, order_id, method, amount, status |
| `payment_confirmation` | Konfirmasi transfer | id, order_id, buyer_name, buyer_discord_id |
| `order_log` | Log perubahan status | id, order_id, actor_type, action, previous_status, new_status |

### Supporting Tables

| Table | Purpose |
|-------|---------|
| `analytics_event` | Event tracking (product_view, order_created, etc.) |
| `sales_forecast` | Prediksi penjualan (moving average 7d) |
| `customer_segment` | RFM segmentation (champion, loyal, at_risk, etc.) |
| `product_recommendation` | Produk rekomendasi (co-occurrence based) |
| `stock_alert` | Alert stok menipis |
| `notification` | Multi-channel notifications |
| `setting` | Key-value store untuk konfigurasi toko |
| `activity_log` | Log aktivitas admin |
| `inventory_log` | Log perubahan stok |
| `wishlist` | Wishlist user |
| `currency_rate` | Kurs mata uang |
| `refresh_token` | Refresh token untuk JWT |
| `testimonial` | Testimonial pelanggan |
| `faq` | Pertanyaan yang sering diajukan |
| `banner` | Banner promosi |

### RLS (Row Level Security)

- **Public Read**: Semua tabel publik bisa dibaca tanpa auth
- **Insert Order**: Siapa pun bisa membuat order
- **Admin Full Access**: Menggunakan function `public.is_admin()` yang mengecek `auth.email()` terhadap `public.user.role = 'ADMIN'`
- **Realtime**: Tabel `product`, `category`, `order`, `order_item`, `product_image`, `setting`, `payment` diaktifkan realtime

---

## 🔐 Authentication & Authorization

### Admin Authentication

Dua metode authentication:

1. **Supabase Auth** (main method):
   - Login menggunakan `supabase.auth.signInWithPassword()`
   - Session dikelola via Supabase cookies
   - Role dicek dari tabel `public.user` via email match
   - `AdminShell.tsx` mengecek session, fallback ke JWT cookie

2. **JWT Cookie** (fallback untuk API routes):
   - `src/lib/auth.ts` — Pure JWT implementation (HS256)
   - `src/lib/admin-auth.ts` — `requireAdmin()` helper untuk API routes

### Admin Login Flow

```
Login Page → Supabase Auth → Check public.user.role = 'ADMIN'
  → Redirect ke /admin → AdminShell verifikasi session
  → Set JWT cookie untuk server-side API access
```

### Credentials Development Default

| Email | Password |
|-------|----------|
| `admin@leizstore.com` | `admin123` |

> **Setup**: Jalankan `npx tsx scripts/create-admin.ts` untuk membuat admin user di Supabase

---

## 💳 Payment Flow

### Arsitektur Payment

```
Checkout → POST /api/orders → orderService.create()
  → Buat order + items (status: PENDING_PAYMENT)
  → Set expiry datetime (24 jam) — PAYMENT_EXPIRY_MS
  → Return order data → Redirect ke /payment/[orderId]

Payment Page (/payment/[orderId]) → Tampilkan instruksi pembayaran
  → Countdown timer (real-time)
  → Upload bukti transfer (image, max 5MB)
  → Klik "Saya Sudah Melakukan Transfer" → POST /api/orders/[orderId]/confirm
  → Order status → WAITING_CONFIRMATION
  → Kirim notifikasi ke Discord seller channel (dengan bukti transfer sebagai attachment)
  → Polling status setiap 15 detik

Discord → Admin lihat embed + buttons di channel seller
  → Klik "✅ Pembayaran sudah masuk" → POST /api/discord/interactions
  → Order status → PAID
  → Kirim item ke customer via Discord DM (sendBuyerNotification)

Auto-Expire → Cron job (Vercel) → POST /api/payments/expire
  → Cek order yang melewati expiry_at
  → Status → EXPIRED
```

### Payment Methods (Manual Transfer)

| Method | Label | Details |
|--------|-------|---------|
| `bank_transfer` | Bank Transfer (BCA) | BCA a.n. LEIZ STORE |
| `gopay` | GoPay | 08123456789 a.n. LEIZ STORE |
| `dana` | DANA | 08123456789 a.n. LEIZ STORE |
| `seabank` | SeaBank | 9876543210 a.n. LEIZ STORE |

> Semua akun pembayaran didefinisikan di `src/lib/payment/constants.ts` — mudah ditambah/diubah.

### Order Status State Machine

```
PENDING → PENDING_PAYMENT → WAITING_CONFIRMATION → PAID → PROCESSING → COMPLETED
                              ↓           ↓           ↓
                           EXPIRED     REJECTED   CANCELLED / FORCE_CANCELLED
                                         ↓
                                    NEEDS_REVIEW
```

**Status Definitions:**
- **PENDING_PAYMENT**: Menunggu pembayaran dari buyer
- **WAITING_CONFIRMATION**: Buyer sudah konfirmasi transfer, menunggu verifikasi admin
- **PAID**: Pembayaran diverifikasi admin
- **NEEDS_REVIEW**: Admin ragu dengan bukti transfer, perlu pengecekan ulang
- **REJECTED**: Pembayaran ditolak (bukti tidak valid)
- **CANCELLED**: Dibatalkan admin
- **FORCE_CANCELLED**: Dibatalkan paksa admin
- **EXPIRED**: Melewati batas waktu 24 jam

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/payment/constants.ts` | Payment accounts, status transitions (STATUS_TRANSITIONS), expiry config |
| `src/lib/payment/payment-service.ts` | Business logic: confirmTransfer, adminAcceptPayment, adminRejectPayment, adminCancelOrder, adminForceCancelOrder, expireOverdueOrders |
| `src/lib/payment/order-logger.ts` | Log status changes to order_log table |
| `src/app/payment/[orderId]/page.tsx` | Payment instructions UI with countdown timer, upload bukti, polling |
| `src/app/api/orders/[orderId]/confirm/route.ts` | API endpoint — buyer confirms transfer, triggers Discord notification |
| `src/app/api/payments/expire/route.ts` | Cron endpoint — expire overdue orders |
| `src/app/api/admin/payment-action/route.ts` | Admin payment action (accept/reject/cancel) |

---

## 🤖 Discord Integration

### Discord Bot Features

| Feature | Description |
|---------|-------------|
| **Seller Notifications** | Kirim embed ke channel seller saat ada konfirmasi transfer baru (dengan bukti transfer sebagai attachment) |
| **Interactive Buttons** | Admin bisa accept/reject/cancel/force_cancel langsung dari Discord |
| **Buyer DM** | Notifikasi ke buyer via Discord DM setelah order diproses (menggunakan bot API) |
| **Webhook Fallback** | Jika bot token tidak dikonfigurasi, fallback ke webhook URL (tanpa interactive buttons) |

### Architecture

```
┌─────────────┐     POST /api/discord/interactions     ┌────────────────┐
│   Discord   │ ←───────────────────────────────────── │ Next.js API    │
│   (Bot)     │ ─────────────────────────────────────→ │ Route          │
└─────────────┘     PATCH webhook (update message)      └────────────────┘

Flow:
1. Buyer konfirmasi transfer → sendSellerNotification() → POST ke channel seller
2. Admin klik button → Discord POST ke /api/discord/interactions
3. API route verify signature (ed25519) → proses action → PATCH webhook update message
4. Gunakan after() untuk async processing (DB update + PATCH webhook)
```

### Interaction Button Actions

| custom_id Pattern | Action | Target Status |
|-------------------|--------|---------------|
| `payment_accept_{orderId}` | ✅ Pembayaran sudah masuk | PAID |
| `payment_reject_{orderId}` | ❌ Pembayaran belum masuk | NEEDS_REVIEW |
| `payment_cancel_{orderId}` | 🚫 Cancel order | CANCELLED |
| `payment_force_cancel_{orderId}` | ⛔ Cancel order paksa | FORCE_CANCELLED |

### Key Files

| File | Purpose |
|------|---------|
| `src/app/api/discord/interactions/route.ts` | Discord HTTP interaction handler (PING, button clicks) — signature verification + after() async processing |
| `src/lib/discord/bot.ts` | `sendSellerNotification()` (embed + buttons ke channel), `sendBuyerNotification()` (DM ke buyer) |
| `src/lib/discord/embeds.ts` | `buildSellerEmbed()`, `buildBuyerEmbed()`, `buildAdminButtons()` |

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `DISCORD_PUBLIC_KEY` | Verify Discord interaction requests (ed25519) |
| `DISCORD_BOT_TOKEN` | Bot token for Discord API calls (DM, channel messages) |
| `DISCORD_SELLER_CHANNEL_ID` | Channel ID untuk notifikasi seller |
| `DISCORD_WEBHOOK_URL` | Fallback webhook URL (tanpa interactive buttons) |

---

## 📄 Halaman & Rute

### Public Pages

| Route | File | Description |
|-------|------|-------------|
| `/` | `src/app/page.tsx` | Homepage dengan hero section, featured products, testimonials, CTA |
| `/products` | `src/app/products/page.tsx` | Katalog produk dengan search, filter, sort |
| `/products/[slug]` | `src/app/products/[slug]/page.tsx` | Detail produk, quantity selector, add to cart |
| `/checkout` | `src/app/checkout/page.tsx` | Multi-step checkout (4 langkah: Customer Info → Order Review → Payment → Confirmation) |
| `/payment/[orderId]` | `src/app/payment/[orderId]/page.tsx` | Payment instructions, countdown timer, upload bukti, polling status |
| `/track` | `src/app/track/page.tsx` | Order tracking by order number — status timeline, item details, payment info |
| `/wishlist` | `src/app/wishlist/page.tsx` | Wishlist (static untuk sekarang) |
| `/terms` | `src/app/terms/page.tsx` | Terms of Service (statis) |
| `/privacy` | `src/app/privacy/page.tsx` | Privacy Policy (statis) |

### Admin Pages (Protected)

| Route | File | Description |
|-------|------|-------------|
| `/admin` | `src/app/admin/page.tsx` | Dashboard dengan stats (revenue, orders, customers) |
| `/admin/login` | `src/app/admin/login/page.tsx` | Login page (Supabase Auth) |
| `/admin/products` | `src/app/admin/products/page.tsx` | CRUD produk |
| `/admin/categories` | `src/app/admin/categories/page.tsx` | CRUD kategori |
| `/admin/orders` | `src/app/admin/orders/page.tsx` | Daftar & detail pesanan |
| `/admin/orders/[id]` | `src/app/admin/orders/[id]/page.tsx` | Detail pesanan spesifik |
| `/admin/users` | `src/app/admin/users/page.tsx` | Daftar customer |
| `/admin/settings` | `src/app/admin/settings/page.tsx` | Konfigurasi toko |

### API Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/products` | GET | List products with pagination, filter, search |
| `/api/products/[slug]` | GET | Product detail by slug |
| `/api/orders` | POST | Create order |
| `/api/orders/track` | GET | Track order by orderNumber or orderId |
| `/api/orders/[orderId]/confirm` | POST | Buyer confirms transfer (dengan bukti gambar) |
| `/api/payments/expire` | POST | Expire overdue orders (cron — setiap hari 00:00 UTC) |
| `/api/discord/interactions` | POST | Discord interaction handler (PING + button clicks) |
| `/api/health` | GET | Health check |
| `/api/admin/login` | POST | Admin login (JWT cookie fallback) |
| `/api/admin/verify` | GET | Verify admin session |
| `/api/admin/logout` | POST | Admin logout |
| `/api/admin/products` | GET/POST | Admin CRUD products |
| `/api/admin/products/[id]` | GET/PUT/DELETE | Admin CRUD product by ID |
| `/api/admin/categories` | GET/POST | Admin CRUD categories |
| `/api/admin/categories/[id]` | GET/PUT/DELETE | Admin CRUD category by ID |
| `/api/admin/orders` | GET | List all orders |
| `/api/admin/orders/[id]` | GET | Order detail |
| `/api/admin/users` | GET | List users |
| `/api/admin/stats` | GET | Dashboard stats |
| `/api/admin/settings` | GET/PUT | Store settings |
| `/api/admin/payment-action` | POST | Admin payment action (accept/reject/cancel) |

---

## 🧩 Komponen UI Utama

### Layout Components

| Component | File | Description |
|-----------|------|-------------|
| Navbar | `src/components/layout/Navbar.tsx` | Fixed top nav with cart, mobile drawer, glass effect on scroll |
| Footer | `src/components/layout/Footer.tsx` | Contact info + payment methods |
| CartDrawer | `src/components/cart/CartDrawer.tsx` | Slide-in cart with quantity controls, totals |
| LivePurchaseTicker | `src/components/layout/LivePurchaseTicker.tsx` | Live purchase notification ticker |

### Product Components

| Component | File | Description |
|-----------|------|-------------|
| ProductCard | `src/components/product/ProductCard.tsx` | Card with image, badge, price, add-to-cart overlay |
| ProductFilters | `src/components/product/ProductFilters.tsx` | Filter sidebar (category, price range) |

### UI Components

| Component | File | Description |
|-----------|------|-------------|
| Animated | `src/components/ui/animated.tsx` | SlideUp animation wrapper (Framer Motion) |
| Icons | `src/components/ui/icons.tsx` | Re-exported Lucide icons (lazy loaded) |

### Performance Components

| Component | File | Description |
|-----------|------|-------------|
| LazySection | `src/components/performance/lazy-section.tsx` | IntersectionObserver lazy loading |
| OptimizedImage | `src/components/performance/optimized-image.tsx` | Next/Image wrapper with blur placeholder |
| ResourceHints | `src/components/performance/resource-hints.tsx` | Preconnect/prefetch hints |
| ViewportOptimizer | `src/components/performance/viewport-optimizer.tsx` | Viewport meta optimization |
| WebVitals | `src/components/performance/web-vitals.tsx` | Web Vitals reporting |
| ThirdPartyScripts | `src/components/performance/third-party-scripts.tsx` | Optimized third-party script loading |

---

## 🛠️ Libraries & Services

### Database Layer (`src/lib/`)

| File | Purpose |
|------|---------|
| `supabase-db.ts` | Database adapter — Prisma-compatible API over Supabase REST |
| `supabase.ts` | Server-side Supabase client (anon + service role) |
| `supabase-browser.ts` | Client-side Supabase client + Realtime subscriptions |
| `db.ts` | Re-export of prisma from supabase-db |
| `prisma-types.ts` | TypeScript type definitions for all 25 models + enums (OrderStatus, PaymentStatus, etc.) |

### Data Access (`src/lib/repositories/`)

| Repository | Key Methods |
|------------|-------------|
| `productRepository` | findMany, findBySlug, findById, create, update, delete, getLowStockProducts, getFeatured, search |
| `categoryRepository` | findMany, findBySlug, findRoots, create, update, delete |
| `orderRepository` | findMany, findById, findByOrderNumber, create, update, getStatusCounts, getRevenueByDateRange |
| `userRepository` | findMany, findByEmail, findById, create, update, getCustomerStats |
| `activityLogRepository` | findMany, create |
| `inventoryLogRepository` | findMany, create |
| `settingRepository` | get, set, getMany, getMap |
| `analyticsRepository` | trackEvent, getEvents, getEventCounts |
| `stockAlertRepository` | findMany, create, markAsRead, markAsSent, getUnreadCount |
| `notificationRepository` | findMany, create, markAsSent, markAsFailed |
| `currencyRateRepository` | getRate, setRate, getAllRates |
| `forecastRepository` | findMany, create |
| `customerSegmentRepository` | findMany, upsert, getSegmentCounts |
| `recommendationRepository` | findMany, getForProduct, create |

### Business Logic (`src/lib/services/`)

| Service | Key Functions |
|---------|---------------|
| `productService` | list (with pagination/filter/sort), getBySlug, getFeatured, getLowStock |
| `orderService` | create (with stock deduction + inventory logs), updateStatus, getStats |
| `analyticsService` | getDashboardStats (revenue, orders, products, customers), getRevenueChart |
| `stockAlertService` | checkAndCreateAlerts, getAlerts, markAsRead |
| `notificationService` | sendTelegram, sendDiscord, sendWhatsApp, sendOrderConfirmation, sendStockAlert |
| `customerSegmentService` | calculateSegments (RFM), getSegmentCounts, getCustomersBySegment |
| `forecastService` | generateForecasts (7-day moving average), getLatestForecasts |
| `recommendationService` | generateRecommendations (co-occurrence), getForProduct |

### Payment Service (`src/lib/payment/`)

| File | Purpose |
|------|---------|
| `constants.ts` | PAYMENT_ACCOUNTS, STATUS_TRANSITIONS, PAYMENT_EXPIRY_MS, ManualPaymentMethod |
| `payment-service.ts` | confirmTransfer, adminAcceptPayment, adminRejectPayment, adminCancelOrder, adminForceCancelOrder, expireOverdueOrders, getOrderForPayment |
| `order-logger.ts` | logOrderStatusChange |

### Discord Service (`src/lib/discord/`)

| File | Purpose |
|------|---------|
| `bot.ts` | sendSellerNotification (bot API + webhook fallback), sendBuyerNotification (DM) |
| `embeds.ts` | buildSellerEmbed, buildBuyerEmbed, buildAdminButtons |

### Other Libraries

| File | Purpose |
|------|---------|
| `auth.ts` | Pure JWT implementation (sign/verify HS256), password hashing (PBKDF2), refresh tokens |
| `admin-auth.ts` | requireAdmin() helper for Supabase Auth session verification |
| `currency.ts` | IDR/USD conversion, formatPrice, getDualPrice, exchange rate fetching |
| `errors.ts` | AppError, NotFoundError, ValidationError, UnauthorizedError, successResponse, errorResponse |
| `validators/order.ts` | Zod schemas: createOrderSchema, confirmTransferSchema, adminPaymentActionSchema |
| `i18n.ts` | Multi-language support (EN/ID), translation dictionaries |
| `utils.ts` | cn (tailwind-merge), formatPrice, formatDate, slugify, etc. |
| `storage.ts` | S3-compatible file upload (AWS S3, Cloudflare R2, MinIO) |
| `motion.tsx` | Framer Motion lazy loading + animation variants |
| `fonts.tsx` | Google Fonts configuration (Geist Sans + Geist Mono via next/font/google) |
| `dynamic-imports.tsx` | Dynamic import utilities for code splitting |
| `middleware.ts` | CORS headers, handleCors |
| `api-helpers.ts` | withErrorHandling wrapper for API routes |
| `prisma-types.ts` | TypeScript enums: OrderStatus, PaymentStatus, ActorType, PaymentMethod |

### State Management (`src/stores/`)

| Store | File | Key Features |
|-------|------|--------------|
| `useCartStore` | `cart-store.ts` | Cart items, CRUD, subtotal/tax(11% PPN)/total calc, persist to localStorage |
| `useThemeStore` | `theme-store.ts` | Theme management |
| `useLocaleStore` | `locale-store.ts` | Locale preferences |

### Data Fallback (`src/data/`)

| File | Content |
|------|---------|
| `products.ts` | 8 produk Dragon Nest Insane + FAQs |

---

## 🎨 Design System

### Theme: Dark Gaming Premium

- **Background**: `#0A0B0F` (deep space black)
- **Primary CTA**: `#00F0FF` (cyber cyan)
- **Secondary**: `#7B2FF7` (deep violet)
- **Tertiary**: `#FF3D71` (hot pink)
- **Surface**: `#12141A`, elevated: `#1A1D26`

### CSS Architecture

- `src/app/globals.css` — TailwindCSS 4 + custom design tokens via `@theme inline`
- `src/styles/performance-animations.css` — Performance-optimized animations
- TailwindCSS 4 dengan `@theme inline` directive untuk custom colors
- CSS custom properties untuk design tokens
- Utility classes: `.btn-primary`, `.btn-secondary`, `.dn-input`, `.dn-card`, `.dn-badge`, `.card-premium`, `.input-premium`

### Typography

- **Font**: Geist (Sans) + Geist Mono (via next/font/google)
- **Scale**: Display (50px) → H2 (36px) → H3 (28px) → H4 (24px) → Body (16px)
- **Weights**: 400 (Regular) default, 600 (Semibold) untuk buttons, 700 (Bold) untuk headings

---

## 📦 Product Catalog

8 produk untuk Dragon Nest Insane:

| Product | Price | Badge | Stock |
|---------|-------|-------|-------|
| Balkov Pouch | Rp150.000 | HOT | 100 |
| Minotaur Pouch | Rp175.000 | HOT | 80 |
| Mount Coupon | Rp250.000 | BEST_SELLER | 50 |
| Pet Coupon | Rp200.000 | BEST_SELLER | 60 |
| Spirit Coupon | Rp220.000 | NEW | 70 |
| DNP | Rp50.000 | BEST_SELLER | 500 |
| Gold Currency | Rp75.000 | — | 999 |
| LEIZ STORE Bundle | Rp500.000 | LIMITED | 30 |

---

## 🌐 Environment Variables

### Required

```env
NEXT_PUBLIC_SUPABASE_URL=           # URL project Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=      # Anon key Supabase
SUPABASE_SERVICE_ROLE_KEY=          # Service role key
JWT_SECRET=                         # Secret key untuk JWT (HS256)
NEXT_PUBLIC_SITE_URL=               # URL publik (default: http://localhost:3000)
```

### Discord

```env
DISCORD_PUBLIC_KEY=                 # Public key Discord bot (ed25519 verification)
DISCORD_BOT_TOKEN=                  # Bot token for Discord API calls
DISCORD_SELLER_CHANNEL_ID=          # Channel ID seller notification
DISCORD_WEBHOOK_URL=                # Fallback webhook URL (tanpa interactive buttons)
```

### Notifications

```env
TELEGRAM_BOT_TOKEN=                 # Bot token Telegram
TELEGRAM_CHAT_ID=                   # Chat ID Telegram
WHATSAPP_API_KEY=                   # API key WhatsApp Gateway
WHATSAPP_API_URL=                   # URL API WhatsApp Gateway
```

### Storage (Opsional)

```env
S3_ENDPOINT=                        # S3-compatible endpoint
S3_BUCKET=                          # Bucket name
S3_ACCESS_KEY=                      # Access key
S3_SECRET_KEY=                      # Secret key
S3_REGION=                          # Region (default: auto)
S3_PUBLIC_URL=                      # Public URL for uploaded files
```

### Lainnya

```env
CRON_SECRET=                        # Secret untuk cron endpoint
CORS_ORIGINS=                       # Allowed CORS origins (comma-separated)
ADMIN_EMAIL=                        # Admin email (fallback)
ADMIN_PASSWORD=                     # Admin password (fallback)
```

---

## 📜 Scripts

### Development

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (Next.js) |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | TypeScript type checking (`tsc --noEmit`) |

### Testing

| Command | Description |
|---------|-------------|
| `npm test` | Run Jest unit tests |
| `npm run test:coverage` | Coverage report |
| `npm run e2e` | Run Playwright E2E tests |

### Database

| Command | Description |
|---------|-------------|
| `npx tsx scripts/create-admin.ts` | Create admin user in Supabase |
| `npx tsx scripts/seed-products.ts` | Seed product data |
| `npx tsx scripts/update-products.ts` | Update product data |

### Performance

| Command | Description |
|---------|-------------|
| `npm run analyze` | Analyze bundle size |
| `npm run optimize` | Optimize bundle |
| `npm run perf` | Build + analyze + lighthouse |

---

## 💡 Current Issues & TODOs

### Issues

- **Freebuff crash on Windows** — Exit code 3221226505 (STATUS_STACK_BUFFER_OVERRUN). Solusi: pindahkan project ke path pendek (e.g., `C:\dev\leiz-store`), downgrade Node.js ke v20.x LTS.

### Recent Changes

- **Knowledge.md**: Renamed from PROJECT.md — auto-loaded oleh Codebuff di setiap session
- **Discord Bot**: Full integration — seller notification (embed + buttons), buyer notification (DM), webhook fallback, interactive button actions (accept/reject/cancel/force_cancel)
- **Cart Tax**: `getTax()` menggunakan 11% PPN (PPN 2025)
- **New Pages**: Terms of Service (`/terms`), Privacy Policy (`/privacy`), Order Tracking (`/track` dengan status timeline)
- **Payment Flow**: Enhanced — countdown timer, upload bukti transfer, polling status 15 detik, auto-redirect ke /payment/[orderId]
- **Supabase DB Test**: Updated model count from 23 to 25 models
- **Vercel Analytics**: Web Analytics + Speed Insights terinstall
- **iPaymu Plan**: Plan file dihapus (tidak diimplementasikan)

### Potential Improvements

- Implementasi QRIS / iPaymu payment gateway
- Email notifications (placeholder di `notifications.ts`)
- Wishlist functionality (halaman statis untuk sekarang)
- Unit test coverage untuk services dan repositories

---

## 🚀 Deployment

### Vercel

- **Framework**: Next.js (auto-detected)
- **Region**: Singapore (sin1) — optimal untuk Asia Tenggara
- **Cron**: `/api/payments/expire` setiap hari jam 00:00 UTC
- **Analytics**: Web Analytics + Speed Insights terinstall
- **Headers**: Security (CSP, HSTS, XSS), caching (static assets immutable, API no-store)
- **Redirects**: `/shop`, `/store`, `/catalog` → `/products`, `/cart` → `/checkout`

### Docker

Multi-stage build di `Dockerfile`:
1. **deps**: Install production dependencies
2. **builder**: Build Next.js standalone output
3. **runner**: Node.js 20 Alpine, non-root user, health check

### Cloudflare

File `public/_headers` dan `public/_redirects` untuk deployment via Cloudflare Pages.

---

## 🔍 Key Files Quick Reference

### For Codebuff Sessions

File ini (`knowledge.md`) otomatis ter-load setiap session — tidak perlu baca manual.

```bash
# Konfigurasi
package.json                        # Dependencies & scripts
next.config.ts                      # Next.js config
vercel.json                         # Vercel deployment config

# Database & Auth
scripts/supabase-schema.sql         # Database schema (25 tables)
src/lib/supabase-db.ts              # Database adapter
src/lib/supabase.ts                 # Server Supabase client
src/lib/auth.ts                     # JWT & password utilities
src/lib/prisma-types.ts             # TypeScript enums

# Business Logic & Payment
src/lib/services/index.ts           # Service layer
src/lib/payment/constants.ts        # Payment accounts, status transitions, expiry config
src/lib/payment/payment-service.ts  # Payment flow business logic
src/lib/discord/bot.ts              # Discord notifications (seller + buyer)

# API Routes
src/app/api/orders/route.ts         # Order creation
src/app/api/orders/[orderId]/confirm/route.ts  # Transfer confirmation
src/app/api/discord/interactions/   # Discord interaction handler
src/app/api/payments/expire/route.ts # Cron: expire overdue orders

# UI Pages
src/app/checkout/page.tsx           # Checkout page (4 steps)
src/app/payment/[orderId]/page.tsx  # Payment page (countdown + upload)
src/app/track/page.tsx              # Order tracking page
src/components/layout/Navbar.tsx    # Main navigation
src/stores/cart-store.ts            # Cart state (Zustand + persist)
```

---

> **Last Updated**: June 30, 2026
> **Project**: leiz-store v2.0.0
> **File**: `knowledge.md` — Auto-loaded by Codebuff
