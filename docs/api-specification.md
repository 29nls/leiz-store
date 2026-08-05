# LEIZ STORE — API Specification

> Versi: 1.0 · Tanggal: 2026-08-05 · Status: ✅ Berlaku untuk implementasi saat ini
>
> Dokumen ini adalah spesifikasi resmi REST API backend **leiz-store**
> (Next.js 14 App Router + Supabase PostgreSQL). Dibuat sebagai langkah
> pertama dari SOP pengembangan: **spesifikasi → endpoint → data flow → testing → dokumentasi**.

---

## 1. Ringkasan Arsitektur

### 1.1 Peta Lapisan (Clean Architecture / Layered)

Proyek ini menerapkan **Layered Architecture** (varian pragmatis dari Clean
Architecture) dengan aliran satu arah:

```
HTTP Request
   │
   ▼
┌─────────────────────────────┐   Route Handler (src/app/api/**/route.ts)
│  PRESENTATION / ROUTER      │   - Parsing request, CORS, memanggil service
│  withErrorHandling wrapper  │   - Tidak berisi logika bisnis
└──────────────┬──────────────┘
               ▼
┌─────────────────────────────┐   Validation Layer (src/lib/validators/**)
│  VALIDATION (Zod)           │   - createOrderSchema, confirmTransferSchema,
│  schemas                     │     adminPaymentActionSchema
└──────────────┬──────────────┘
               ▼
┌─────────────────────────────┐   Service Layer (src/lib/services/**)
│  BUSINESS LOGIC             │   - orderService, productService,
│  (services/index.ts,        │     analyticsService, notificationService,
│   payment/payment-service)  │     payment-service, queue-service
└──────────────┬──────────────┘
               ▼
┌─────────────────────────────┐   Repository Layer (src/lib/repositories/**)
│  DATA ACCESS                │   - productRepository, orderRepository,
│  (repositories/index.ts)    │     userRepository, notificationRepository, dst.
│  Prisma + supabaseAdmin RPC │
└──────────────┬──────────────┘
               ▼
┌─────────────────────────────┐   Data Store
│  SUPABASE (PostgreSQL)      │   - Tabel: user, product, order, order_item,
│  + Storage (bukti bayar)    │     payment, payment_confirmation, dll.
│  + queue / cron jobs        │   - create_order_atomic (RPC transaksional)
└─────────────────────────────┘
```

### 1.2 Prinsip

| Aspek | Aturan |
|---|---|
| **Route** | Hanya mem-parsing input & menyusun respons. Tidak ada SQL/bisnis. |
| **Service** | Satu-satunya tempat logika bisnis (harga, status transisi, idempotensi). |
| **Repository** | Satu-satunya akses data (Prisma / supabaseAdmin RPC). |
| **Validator** | Zod di setiap titik masuk yang membutuhkan data terstruktur. |
| **Auth** | Layer terpisah (`src/lib/auth.ts`, `src/lib/admin-auth.ts`). |
| **Error** | Exception `AppError` terpusat; route dibungkus `withErrorHandling`. |

---

## 2. Konvensi API

### 2.1 Envelope Respons

Semua endpoint publik & checkout memakai envelope standar:

```jsonc
// Sukses
{ "success": true, "data": { ... }, "meta": { "page": 1, "limit": 20, "total": 50, "totalPages": 3 } }

// Gagal
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "items: ...", "details": { "field": ["pesan"] } } }
```

> ✅ **Semua endpoint** (publik, admin, system) kini konsisten memakai envelope
> standar ini. List endpoint menempatkan array di `data` dan paginasi di `meta`
> (`{ "data": [...], "meta": { "page", "limit", "total", "totalPages" } }`).

### 2.2 Kode Error Standar

| HTTP | `error.code` | Sumber |
|---|---|---|
| 400 | `VALIDATION_ERROR` | `ValidationError` (Zod gagal, stok kurang, dll.) |
| 401 | `UNAUTHORIZED` | `UnauthorizedError` (token salah / tidak ada) |
| 403 | `FORBIDDEN` | `ForbiddenError` (role tidak cukup) |
| 404 | `NOT_FOUND` | `NotFoundError` (produk/order tidak ada) |
| 409 | `CONFLICT` | `ConflictError` (idempotency key dipakai ulang, slug duplikat) |
| 429 | `RATE_LIMITED` | `RateLimitError` |
| 500 | `INTERNAL_ERROR` | Error tak dikenal (tidak membocorkan detail) |

`withErrorHandling` menjamin **tidak ada stack trace / pesan internal yang
bocor** ke klien pada 500.

### 2.3 Autentikasi

Ada **dua jalur** yang didukung secara paralel:

1. **Supabase Auth (primer)** — session cookie `sb-*` atau
   `Authorization: Bearer <access_token>`. Identitas admin diverifikasi lewat
   tabel `user` (role `ADMIN`, `is_active != false`).
2. **Legacy JWT (fallback migrasi)** — cookie `admin_token` atau
   `Authorization: Bearer <jwt>` HS256 (24 jam), role wajib `ADMIN`.

`requireAdmin(request)` / `isAdminRequest()` adalah guard terpusat di
`src/lib/admin-auth.ts`. Endpoint system menggunakan **secret header**
terpisah (lihat §5.3).

### 2.4 Middleware Umum (`src/lib/middleware.ts`)

| Fitur | Detail |
|---|---|
| **CORS** | `CORS_ORIGINS` (default `http://localhost:3000`); preflight `OPTIONS` → 204. |
| **Rate limit** | Redis/KV-backed (`src/lib/rate-limit.ts`, fallback in-memory untuk dev); header `X-RateLimit-Limit/-Remaining/-Reset`. Lihat tabel lengkap di `docs/openapi.yaml` §Rate limit. |
| **Pagination** | `page` (min 1), `limit` (1–100, default 20); helper `parsePagination`. |
| **Sort** | `parseSort` dengan allowlist kolom. |
| **Store context** | Header `X-Store-Id` / `X-Store-Slug`, query `store_slug` (multi-toko). |
| **IP/UA** | `getClientIp`, `getUserAgent` untuk log & rate limit. |

### 2.5 Keamanan (Secure Coding Practices)

- Token konfirmasi pembayaran **hanya disimpan sebagai hash** di DB
  (`payment_confirmation_token_hash`); token asli dikirim via cookie
  `httpOnly` (path-scoped ke `/api/orders/:id/confirm`).
- Cookie: `httpOnly`, `secure` di production, `sameSite=lax`.
- Update status order memakai **conditional update** (`.eq("status", current)`)
  + **validasi transisi state machine** → cegah double-process / race.
- Idempotensi checkout: header `Idempotency-Key` + RPC `create_order_atomic`
  (transaksi Postgres; stok dipesan atomik; replay mengembalikan order sama).
- Rate limit di endpoint publik (products, orders, track, confirm) & semua route admin. Endpoint system/cron/discord tidak di-rate-limit.
- Password admin: PBKDF2-SHA512 (100k iterasi) atau Supabase Auth.
- Public tracking memakai **allowlist field eksplisit** (tidak pernah
  meneruskan email/notes/token hash/proof path).
- Perbandingan secret admin pakai `timingSafeEqual`.

---

## 3. Daftar Endpoint

### 3.1 Publik (tanpa auth)

| # | Method | Path | Deskripsi |
|---|---|---|---|
| 1 | GET | `/api/health` | Health check server. |
| 2 | GET | `/api/products` | List produk aktif (paginasi, filter, dual currency). |
| 3 | GET | `/api/products/:slug` | Detail produk + kategori + gambar. |
| 4 | POST | `/api/orders` | Buat order (manual payment) — **idempoten** dengan `Idempotency-Key`. |
| 5 | POST | `/api/orders/:orderId/confirm` | Pembeli konfirmasi transfer + upload bukti (multipart). |
| 6 | GET | `/api/orders/track?orderNumber=LZ-…` atau `?orderId=…` | Lacak status order (allowlist field). |

### 3.2 Admin (Supabase Auth / legacy JWT admin)

| # | Method | Path | Deskripsi |
|---|---|---|---|
| 7 | POST | `/api/admin/login` | Login admin (Supabase Auth primer, fallback legacy). |
| 8 | POST | `/api/admin/logout` | Logout admin. |
| 9 | GET | `/api/admin/verify` | Verifikasi session admin aktif. |
| 10 | GET | `/api/admin/stats` | Statistik dashboard (revenue, orders, produk, stok rendah). |
| 11 | GET/POST | `/api/admin/products` | List / buat produk. |
| 12 | PUT/DELETE | `/api/admin/products/:id` | Update / hapus produk. |
| 13 | GET/POST | `/api/admin/categories` | List / buat kategori. |
| 14 | PUT/DELETE | `/api/admin/categories/:id` | Update / hapus kategori. |
| 15 | GET/POST | `/api/admin/orders` | List order (search/status/paginasi) / aksi manual. |
| 16 | GET/PUT/DELETE | `/api/admin/orders/:id` | Detail / update status / hapus order. |
| 17 | GET/POST | `/api/admin/users` | List / buat user. |
| 18 | GET/PATCH/DELETE | `/api/admin/users/:id` | Detail / update / hapus user. |
| 19 | GET/PUT | `/api/admin/settings` | Baca / ubah pengaturan toko. |
| 20 | GET/POST | `/api/admin/invoices` | List / buat invoice. |
| 21 | GET | `/api/admin/invoices/:id/download` | Unduh PDF invoice. |
| 22 | POST | `/api/admin/upload` | Upload gambar/aset ke Storage. |

### 3.3 Sistem & Webhook (secret khusus)

| # | Method | Path | Auth | Deskripsi |
|---|---|---|---|---|
| 23 | POST | `/api/admin/payment-action` | `x-admin-secret` / Bearer (`DISCORD_ADMIN_SECRET`) | Aksi verifikasi pembayaran dari Discord bot / panel admin. |
| 24 | POST | `/api/payments/expire` | internal | Expire order lewat batas waktu (dipanggil cron/queue). |
| 25 | GET | `/api/cron/process-jobs` | internal | Proses antrian job (cron). |
| 26 | POST | `/api/discord/interactions` | Verifikasi signature Discord | Slash-command Discord bot (cek status, dll.). |

---

## 4. Spesifikasi Endpoint Kunci (Request/Response)

### 4.1 `POST /api/orders` — Buat Order

**Headers**

| Header | Wajib | Keterangan |
|---|---|---|
| `Content-Type: application/json` | ✅ | — |
| `Idempotency-Key` | opsional | **UUID v4** (diverifikasi `validateIdempotencyKey`, max 128); replay mengembalikan order yang sama tanpa membuat duplikat. |
| `Authorization` / cookie | opsional | Jika ada `userId` tersimpan (pembeli terdaftar). |

**Request body (Zod `createOrderSchema`)**

```jsonc
{
  "customerName": "Budi",                  // string 1–100
  "customerDiscord": "123456789012345678", // numerik 17–19 digit | user#0000 | username
  "customerIGN": "",                       // opsional, max 100
  "customerNotes": "",                     // opsional, max 500
  "items": [
    { "productId": "prod_abc", "quantity": 2 }   // qty int 1–999
  ],
  "paymentMethod": "qris",                 // string non-empty
  "currency": "IDR"                        // default "IDR"
}
```

**Respons 201**

```jsonc
{
  "success": true,
  "data": {
    "id": "...", "order_number": "LZ-20260805-ABC123",
    "status": "PENDING_PAYMENT",
    "subtotal": 100000, "tax": 11000, "total": 111000,
    "currency": "IDR", "payment_method": "qris",
    "expiry_at": "2026-08-05T15:00:00.000Z",
    "manualPayment": true, "replayed": false
    // note: hash token TIDAK pernah dikembalikan
  }
}
```

**Side effect:** set cookie `payment_confirmation_<orderId>` (httpOnly,
path-scoped) berisi token konfirmasi; catat event analytics `order_created`;
log status `ORDER_CREATED_MANUAL_PAYMENT`.

**Flow (service `orderService.create` → `create_order_atomic` RPC):**

```
1. Validasi Zod + validasi Idempotency-Key header
2. Preflight produk (hanya bila non-idempotent): cek produk ada + stok cukup + hitung subtotal preview
3. Hitung harga otoritatif di RPC create_order_atomic (transaksi Postgres):
     - insert order (PENDING_PAYMENT, token hash, expiry_at, order_number LZ-YYYYMMDD-xxxxxx)
     - insert order_item (snapshot nama/harga)
     - reserve stock (decrement + inventory_log) atomik
     - jika idempotency key ada: simpan fingerprint + encrypted token
4. Replay → kembalikan order lama + decrypt token asli (tanpa ubah data)
5. Side effects non-bloking (Promise.allSettled): order log, analytics
```

### 4.2 `POST /api/orders/:orderId/confirm` — Konfirmasi Transfer

**Auth:** token konfirmasi (dari cookie `payment_confirmation_<orderId>` ATAU body `confirmationToken`).
**Rate limit:** 5 percobaan / 10 menit / IP per order.

**Request:** `multipart/form-data` (disarankan) atau JSON.

| Field | Tipe | Wajib |
|---|---|---|
| `buyerName` | string 1–100 | ✅ |
| `buyerDiscordId` | string (valid Discord ID) | ✅ |
| `confirmationToken` | string | wajib jika tidak ada cookie |
| `note` | string ≤ 500 | opsional |
| `paymentProof` | file (multipart) | opsional |

**Flow (`payment-service.confirmTransfer`):**

```
1. Rate limit → validasi Zod
2. verifyPaymentToken(hash di DB) → 401 bila gagal
3. Status harus PENDING_PAYMENT, dan belum expired (jika expired → auto EXPIRED)
4. Insert payment_confirmation (anti duplikat: cek 23505 / unique → "sudah dikonfirmasi")
5. Conditional update status → WAITING_CONFIRMATION + confirmed_at + payment_proof
6. Jika update kalah race → rollback record konfirmasi (agar bisa retry)
7. Notifikasi seller via Discord; clear cookie konfirmasi
```

**Respons 200:** `{ "success": true, "data": { "message": "Transfer confirmed", "orderId": "..." } }`

### 4.3 `GET /api/orders/track` — Lacak Order

**Query:** `orderNumber=LZ-YYYYMMDD-XXXXXX` **atau** `orderId=...`
(validasi format ketat; `orderId` regex `[a-zA-Z0-9_-]{8,64}`).
**Rate limit:** 10/mnt/IP.

- `?orderId=` → data kaya dari `getOrderForPayment` dengan **allowlist field**
  (tanpa email/notes/token hash/proof path).
- `?orderNumber=` → data tracking singkat: items, subtotal/tax/total, status
  history (PENDING→PAID→COMPLETED), status pembayaran.

### 4.4 `POST /api/admin/payment-action` — Aksi Verifikasi (System)

**Auth:** `x-admin-secret: <DISCORD_ADMIN_SECRET>` atau
`Authorization: Bearer <secret>` (dibandingkan dengan `timingSafeEqual`).

**Body (Zod `adminPaymentActionSchema`)**

```jsonc
{ "orderId": "...", "action": "accept" }   // accept | reject | cancel | force_cancel
```

**State machine transisi yang valid** (dari `payment/constants`): setiap aksi
memakai conditional update sehingga aksi ganda (klik 2×) tidak double-proses.
Side effect: log status + notifikasi pembeli via Discord DM.

### 4.5 `GET /api/products` — List Produk

**Query params:** `page`, `limit`, `category` (slug), `q` (search),
`sort` (`price_asc|price_desc|newest|name`), `badge`, `featured=true`,
`minPrice`, `maxPrice`, `currency` (`IDR`|`USD`).

**Rate limit:** 60 request/menit/IP (sama untuk detail produk `GET /api/products/:slug`).

**Respons 200:** `{ success, data: [product+priceFormatted], meta: {page, limit, total, totalPages} }`
— produk menyertakan `priceFormatted` sesuai currency (`Rp…` / `$…`).

---

## 5. Model Data (ringkas)

| Tabel | Kolom kunci |
|---|---|
| `user` | id, email, name, role (`ADMIN`/`CUSTOMER`), discord, phone, is_active |
| `product` | id, name, slug, price, price_usd, stock, min_stock, badge, category_id, is_active, is_featured |
| `product_image` | id, product_id, url, alt, sort_order |
| `category` | id, name, slug, parent_id, sort_order, is_active |
| `order` | id, order_number, status, customer_name, customer_discord, buyer_discord_id, subtotal, tax, total, total_usd, currency, payment_method, user_id, expiry_at, confirmed_at, paid_at, cancelled_at, payment_confirmation_token_hash |
| `order_item` | id, order_id, product_id, name, price, quantity, total (snapshot harga saat checkout) |
| `payment` | id, order_id, method, status, verified_at |
| `payment_confirmation` | id, order_id (unique), buyer_name, buyer_discord_id, note |
| `inventory_log` | id, product_id, change, previous_stock, new_stock, reason |
| `activity_log` | id, user_id, action, entity, entity_id, details, ip_address |
| `analytics_event` | id, event, entity, entity_id, user_id, metadata |
| `notification` | id, channel, recipient, subject, body, status |
| `stock_alert` | id, product_id, type, threshold, current_stock, is_read |
| `sales_forecast`, `customer_segment`, `product_recommendation`, `currency_rate`, `setting` | analitik & konfigurasi |

**Status order (state machine):** `PENDING → PENDING_PAYMENT → WAITING_CONFIRMATION
→ PAID → COMPLETED`, plus `REJECTED`, `CANCELLED`, `FORCE_CANCELLED`, `EXPIRED`.
Transisi divalidasi di `isValidTransition`.

---

## 6. Alur Data (Data Flow) Utama

### 6.1 Checkout (End-to-End)

```
Pembeli (UI /cart)
  → POST /api/orders { items, customer, paymentMethod }  [+ Idempotency-Key]
  → [Zod] → orderService.create
  → RPC create_order_atomic (1 transaksi: order + items + stock -qty + inventory_log)
  → 201: order PENDING_PAYMENT + cookie token konfirmasi (httpOnly)
  → Pembeli diarahkan ke /payment/:orderId (QRIS/manual transfer)
```

### 6.2 Konfirmasi & Verifikasi

```
Pembeli upload bukti
  → POST /api/orders/:id/confirm (multipart, token dari cookie)
  → payment_service.confirmTransfer
  → payment_confirmation + status → WAITING_CONFIRMATION
  → Discord DM/embed ke seller (sendSellerNotification)
  → Admin (panel atau bot Discord) klik ACCEPT/REJECT/CANCEL
  → POST /api/admin/payment-action { orderId, action }
  → conditional update → PAID (paid_at) | REJECTED | CANCELLED
  → notifikasi pembeli via Discord DM (sendBuyerNotification)
  → (opsional) queue job: invoice, fulfillment, stock alert
```

### 6.3 Expiry (Otomatis)

```
Cron /queue → POST /api/payments/expire (atau process-jobs)
  → expireOverdueOrders(): ambil order PENDING_PAYMENT/WAITING_CONFIRMATION
    dengan expiry_at < now → conditional update → EXPIRED (per order, aman race)
```

### 6.4 Tracking

```
Pembeli → GET /api/orders/track?orderNumber=LZ-…
  → orderRepository.findByOrderNumber → statusHistory + ringkasan
  (field sensitif tidak pernah terekspos)
```

---

## 7. Validasi Input (Ringkasan Zod)

| Schema | Lokasi | Inti |
|---|---|---|
| `createOrderSchema` | `src/lib/validators/order.ts` | nama ≤100, Discord ID valid, items ≥1 (qty 1–999), paymentMethod non-empty |
| `confirmTransferSchema` | sama | buyerName, buyerDiscordId, token opsional (dicek `isValidPaymentToken`), note ≤500 |
| `adminPaymentActionSchema` | sama | action enum `accept/reject/cancel/force_cancel` |
| `isValidDiscordId` | sama | snowflake 17–19 digit \| `user#0000` \| username 2–32 char |
| `createProductSchema` | `src/lib/validators/admin.ts` | nama ≤200, slug `[a-z0-9-]`, price ≥0 (coerce), stock int, images ≤20 |
| `updateProductSchema` | sama | `createProductSchema.partial()` (toggle `{ isActive }` aman) |
| `createCategorySchema` | sama | nama ≤100, slug opsional, sortOrder int ≥0 |
| `updateCategorySchema` | sama | partial; tolak sortOrder negatif |
| `createUserSchema` | sama | email regex non-polinomial ≤254, password ≥6, role `ADMIN`/`CUSTOMER` |
| `updateUserSchema` | sama | partial; tolak body kosong (refine); email UI diterima & diabaikan |
| `upsertSettingSchema` | sama | key ≤100, value di-coerce ke string (kolom `value TEXT`) |
| `uploadFileSchema` | sama | `File`, tipe JPEG/PNG/WebP/AVIF, ≤5MB, non-kosong |

Selain itu: regex ketat `orderNumber` (`LZ-\d{8}-[A-Z0-9]{6}`) dan `orderId`
pada tracking. Semua route admin create/update kini memakai Zod
(`zodErrorMessages` menghasilkan pesan `field: pesan` yang dibungkus
`ValidationError` → HTTP 400).

---

## 8. Rencana Testing API

Setelah implementasi/migrasi, jalankan verifikasi berikut (unit + integration):

1. **Unit (Jest, `npm test`)**
   - `auth.test.ts` — sign/verify JWT, expired token, token korup.
   - `payment-service.test.ts` — transisi status valid/invalid, token salah,
     duplicate confirmation (race 23505), expiry auto.
   - `order-idempotency.test.ts` — fingerprint, replay, key expired.
   - `validators` — skenario Zod pass/fail untuk setiap schema.
2. **Route test** — `src/app/api/orders/__tests__/route.test.ts` & confirm:
   - 201 sukses + cookie ter-set; 400 body invalid; 400 Idempotency-Key invalid.
   - confirm: 401 token salah, 429 rate limit, 400 status bukan
     PENDING_PAYMENT, 409 double-confirm.
3. **E2E (Playwright, `e2e/checkout-payment.spec.ts`, `smoke.spec.ts`)**
   - Alur checkout → halaman pembayaran → konfirmasi.
4. **Manual smoke via curl** — health, products, order create→track→confirm,
   admin login→payment-action (dengan secret).

---

## 9. Temuan & Agenda Teknis (untuk iterasi berikutnya)

- [x] **Konsolidasi envelope respons** semua endpoint (publik + admin) → `{ success, data, error, meta }` seragam (2026-08-05).
- [x] **Zod di semua route admin** (products, categories, users, settings, upload — create & update) + unit test `src/lib/validators/__tests__/admin.test.ts`.
- [x] **Rate limit di lebih banyak endpoint** publik/admin — products list/detail (60/mnt/IP), orders create (20/mnt/IP), track (10/mnt/IP), confirm (5/10mnt/IP/order), admin login, semua route admin (120/mnt/IP/route) (2026-08-05).
- [x] **Migrasi storage rate-limit** dari in-memory ke Redis/KV untuk multi-instance — `src/lib/rate-limit.ts` (Vercel KV / Upstash REST, fallback in-memory) (2026-08-05).
- [ ] **Idempotensi-Key** di ekspose ke dokumentasi frontend + test double-submit.
- [ ] **Dokumentasi OpenAPI** dari spesifikasi ini (opsional, generate dari sini).
