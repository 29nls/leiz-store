# 🛒 LEIZ STORE — Dragon Nest Insane Game Materials Marketplace

Selamat datang di repository resmi **LEIZ STORE**. Proyek ini adalah platform marketplace premium berbasis web untuk memfasilitasi transaksi jual-beli material game Dragon Nest Insane (DNP, gold, pouches, coupons, dll.) secara aman, terverifikasi, dan otomatis melalui koordinasi multi-agent AI.

---

## 🛠️ Tech Stack & Arsitektur

Proyek ini dibangun di atas fondasi teknologi modern:
- **Frontend / Backend**: Next.js 16 (App Router) + React 19 + TypeScript
- **Database / Backend-as-a-Service**: Supabase (PostgreSQL, Realtime, Row-Level Security)
- **State Management**: Zustand (dengan persitensi local storage)
- **Styling**: Tailwind CSS v4 + Framer Motion (untuk animasi transisi checkout)
- **Testing**: Jest (Unit testing) + Playwright (End-to-End integration testing)
---

## 🔐 Alur Pembayaran & Integrasi Discord

Pembayaran dilakukan secara **manual** melalui transfer bank / e-wallet (BCA, GoPay, DANA, SeaBank). Admin memverifikasi pembayaran langsung dari Discord menggunakan tombol interaktif.

```
Buyer checkout → Upload bukti transfer → Discord embed dengan buttons
  ↓ Admin klik "✅ Pembayaran sudah masuk"
  → PATCH webhook Discord → Update status order → Notifikasi DM ke buyer
```

**Tombol Discord:**

| custom_id | Aksi | Status Order |
|---|---|---|
| `payment_accept_{orderId}` | Pembayaran sudah masuk | `PAID` |
| `payment_reject_{orderId}` | Pembayaran belum masuk | `REJECTED` |
| `payment_cancel_{orderId}` | Cancel order | `CANCELLED` |
| `payment_force_cancel_{orderId}` | Cancel order paksa | `FORCE_CANCELLED` |

---

## 🔒 Security & Compliance

### Order Payment Integrity

Order creation accepts an optional `Idempotency-Key` header. The checkout client reuses one UUID for retries, while requests without the header remain backward compatible without duplicate-request guarantees. Payment confirmation tokens are delivered through an order-scoped HttpOnly cookie and are never placed in payment URLs or public order JSON. A temporary body-token fallback remains for older clients; query-string tokens are not accepted.

Apply `scripts/migrations/008_order_idempotency.sql` after migrations `005_security_atomic_orders.sql` and `006_payment_security.sql`, and before deploying application code that sends idempotency parameters. The migration removes the old three-argument `create_order_atomic` overload and grants the six-argument function only to `service_role`. The reset/install baseline is `scripts/supabase-schema.sql`; production deployments must apply numbered migrations after the baseline so the baseline and live database remain aligned. Do not drop `order_idempotency` while keyed checkouts may still be active.

The seven-day idempotency retention window must be maintained by the scheduled maintenance process. After the window, run `DELETE FROM public.order_idempotency WHERE expires_at <= NOW()` with the service role. Until that cleanup is automated, monitor table growth and do not reuse expired keys.

Production must define `PAYMENT_IDEMPOTENCY_ENCRYPTION_KEY` as a base64-encoded 32-byte secret. Store it only in the deployment secret manager; never expose it to the browser or commit it. Rotating this key requires retaining the previous key until all encrypted idempotency records have expired, or performing an explicit replay-record migration.


Proyek ini mengikuti rekomendasi **OWASP** dan telah diaudit oleh **CodeQL**, **Microsoft Defender for DevOps (MSDO)**, dan **njsscan**.

### Password Hashing

Semua password di-hash dengan **PBKDF2** (NIST SP 800-132 compliant):

- 100,000 iterasi SHA-512
- 16-byte random salt per user
- Output format: `${salt}:${hex}` — self-contained

File: `src/lib/auth.ts` → `hashPassword()` + `verifyPassword()`

### Admin Login

- **Tidak ada hardcoded credentials** di source code
- Email dan password admin wajib diset via environment variables (`ADMIN_EMAIL`, `ADMIN_PASSWORD`)
- Jika env vars missing, login ditolak dengan HTTP 500 (fail-secure)
- Production authentication via Supabase Auth (`signInWithPassword`)

### Input Validation

- Email validation menggunakan regex **linear-time** (tidak vulnerable terhadap ReDoS / CWE-1333)
- Hard length cap (254 bytes per RFC 5321) applied sebelum regex test
- Zod schemas untuk order creation + payment confirmation

### Logging Policy

- Tidak ada cleartext logging dari data sensitif (CWE-312 / CWE-532)
- Scripts yang generate password hashes tidak melog password atau derivasinya
- Production logging fokus pada events, bukan payloads

### Tools & Scripts

| Script | Usage | Notes |
|--------|-------|-------|
| `npm run seed` | Seed products | Requires Supabase credentials |
| `npm run seed:admin` | Create admin user | Interactive prompt, no password echo |
| `node scripts/hash-password.js <password>` | Generate bcrypt hash | Password read from CLI arg, never hardcoded |

---

## 🏗️ CI/CD Pipeline

Proyek ini menggunakan GitHub Actions untuk automated testing dan deployment ke Vercel.

| Workflow | Trigger | Tugas |
|----------|---------|-------|
| **CI Pipeline** | push/PR to main | Lint, TypeCheck, Unit Tests, Build, E2E Tests |
| **CodeQL Advanced** | push/PR + weekly | Security scanning (actions, JS/TS, Python) |
| **MSDO** | push/PR + weekly | Microsoft Defender static analysis |
| **njsscan** | push/PR + weekly | Node.js security scanning |

**Environment Variables yang dibutuhkan:**

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key
- `JWT_SECRET` — JWT signing secret (required di production)
- `DISCORD_PUBLIC_KEY` — Discord interaction verification
- `DISCORD_BOT_TOKEN` — Discord bot token
- `CRON_SECRET` — Secret untuk cron endpoints (`/api/cron/process-jobs`)
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — Admin login credentials (via Supabase Auth)
- `BREVO_SMTP_HOST` / `BREVO_SMTP_PORT` / `BREVO_SMTP_USER` / `BREVO_SMTP_PASS` — Brevo SMTP untuk invoice email
- `BREVO_FROM_EMAIL` / `BREVO_FROM_NAME` — Email pengirim invoice
- `INVOICE_STORAGE_BUCKET` — Supabase Storage bucket untuk PDF invoice
- `PAYMENT_IDEMPOTENCY_ENCRYPTION_KEY` — base64-encoded 32-byte server-only key for keyed checkout replay

The current Jest migration checks verify the SQL contract statically. A deployment with a Supabase/PostgreSQL test project must additionally execute migration 008 and run concurrent same-key requests, asserting one order and one stock decrement before production rollout.

---

## 📜 NPM Scripts

| Command | Deskripsi |
|---------|-----------|
| `npm run dev` | Start development server |
| `npm run build` | Production build (Next.js) |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | TypeScript type checking |
| `npm run test` | Run Jest unit tests |
| `npm run e2e` | Run Playwright E2E tests |
| `npm run seed` | Seed database (products) |
| `npm run seed:admin` | Create admin user |
| `npm run seed:update` | Update existing products |
| `npm run analyze` | Bundle size analysis |
| `npm run perf` | Build + analyze + Lighthouse |

---

## 🚀 Memulai Development Lokal

1. Clone repository ini.
2. Install dependensi:
   ```bash
   npm install
   ```
3. Konfigurasi environment variables dengan menyalin `.env.example` ke `.env.local`.
4. Seed database (opsional):
   ```bash
   npm run seed
   ```
5. Jalankan server development:
   ```bash
   npm run dev
   ```
6. Akses platform lokal di `http://localhost:3000`.

---

## 📂 Struktur Folder Penting

```
leiz-store/
├── src/
│   ├── app/                     # Next.js App Router pages & API
│   │   ├── admin/               # Admin panel
│   │   ├── checkout/            # Checkout flow (4 steps)
│   │   ├── payment/             # Payment confirmation page
│   │   ├── products/            # Product catalog & detail
│   │   ├── api/                 # REST API endpoints
│   │   │   ├── admin/invoices/  # Admin invoice API (list + resend)
│   │   │   └── cron/process-jobs/  # Cron: drain job queue
│   ├── components/              # React components
│   │   ├── cart/                # Cart components
│   │   ├── checkout/            # Checkout components
│   │   ├── layout/              # Navbar, Footer, LivePurchaseTicker
│   │   ├── performance/         # Performance optimization
│   │   └── product/             # Product display components
│   ├── hooks/                   # Custom React hooks
│   ├── lib/                     # Utility libraries
│   │   ├── api/                 # API client utilities
│   │   ├── discord/             # Discord integration
│   │   ├── invoice/             # Invoice system (PDF, email, WhatsApp)
│   │   │   ├── invoice-service.ts   # Orchestrator
│   │   │   ├── pdf-generator.ts     # A4 PDF via pdfkit
│   │   │   ├── email-sender.ts      # Brevo SMTP (nodemailer)
│   │   │   ├── whatsapp-sender.ts   # WhatsApp notification
│   │   │   └── types.ts
│   │   ├── queue/               # Persistent job queue (Supabase)
│   │   │   ├── queue-service.ts # Enqueue, dequeue, retry
│   │   │   └── types.ts
│   │   ├── payment/             # Payment service & constants
│   │   ├── validators/          # Zod validators
│   │   ├── auth.ts              # JWT utilities (lazy init)
│   │   └── supabase.ts          # Supabase clients (lazy Proxy)
│   └── types/                   # TypeScript type definitions
├── scripts/                     # Setup & maintenance scripts
├── .github/workflows/           # CI/CD GitHub Actions
└── e2e/                         # Playwright E2E tests
```

---

## 📝 Changelog

### Juli 2026

- ✅ Fix Discord "This interaction failed" error (synchronous execution)
- ✅ Fix 15 audit bugs (CSS animation, React keys, SSR, payment flow)
- ✅ Migrate `styled-jsx` → global CSS (app router compatible)
- ✅ Zero lint errors and TypeScript warnings
- ✅ Lazy initialization pattern untuk runtime secrets di build time
- ✅ CI/CD pipeline fully operational (lint → test → build → E2E)
- ✅ Dependabot configured (npm + github-actions)
- ✅ MSDO, CodeQL, njsscan workflows configured

#### 📄 Invoice System

- ✅ Invoice generation (PDF via pdfkit — A4, IDR/USD, multi-item, diskon, pajak)
- ✅ Email delivery via Brevo SMTP (nodemailer, HTML template + PDF attachment)
- ✅ WhatsApp notification (via existing API atau fallback `whatsapp_queue` table)
- ✅ Persistent job queue (`job_queue` table) dengan retry + exponential backoff
- ✅ Idempotency guards: atomic `UPDATE orders` + `ON CONFLICT DO NOTHING` on INSERT invoice
- ✅ Admin invoice page: tabel, filter status, pagination, modal detail, tombol resend
- ✅ Admin REST API: `GET /api/admin/invoices` (list) + `POST` (resend action)
- ✅ Cron endpoint `GET /api/cron/process-jobs` (maxDuration 120s, auth via Bearer/x-cron-secret)
- ✅ Vercel CRON job (every 5 menit, `vercel.json`)
- ✅ 29+ unit tests (pdf-generator, email-sender, whatsapp-sender, invoice-service, queue-service)

#### 🔐 Security Hardening

- ✅ Hardcoded credentials removed (CWE-798)
  - `scripts/hash-password.js` reads password from CLI arg
  - `src/app/api/admin/login/route.ts` requires `ADMIN_EMAIL` + `ADMIN_PASSWORD` env vars (no fallbacks)
- ✅ Password hashing migration to **PBKDF2** (CWE-916 resolved)
  - `src/lib/auth.ts` uses PBKDF2 with 100k iterations + SHA-512 + random salt
  - Applied to `src/app/api/admin/users/route.ts` + `scripts/create-admin.ts`
- ✅ Cleartext logging of sensitive data removed (CWE-312 / CWE-532)
  - `hash-password.js` output no longer includes password-derived fields
- ✅ Email regex hardened against ReDoS (CWE-1333)
  - Linear-time `EMAIL_RE` pattern + 254-byte length cap
- ✅ GitHub Actions least-privilege permissions
  - Top-level `contents: read` baseline
  - Per-job explicit permissions (CodeQL CKV2_GHA_1 compliant)
  - `id-token: write` for MSDO OIDC authentication
- ✅ CodeQL Action upgraded to v4 (Node 24 compatible)
- ✅ CodeQL advanced setup conflict resolved (disabled default setup)

### Sebelumnya

- Implementasi multi-agent orchestration
- Discord webhook integration dengan interactive buttons
- Supabase RLS dengan payment flow verification
- Framer Motion checkout transitions

---

Dibuat oleh MACENG.
Dragon Nest Insane DN — Premium Game Materials Marketplace
