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
│   │   └── api/                 # REST API endpoints
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

### Sebelumnya

- Implementasi multi-agent orchestration
- Discord webhook integration dengan interactive buttons
- Supabase RLS dengan payment flow verification
- Framer Motion checkout transitions

---

Dibuat oleh MACENG.
Dragon Nest Insane DN — Premium Game Materials Marketplace
