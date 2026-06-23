# LEIZ STORE — Premium Game Materials Marketplace

A modern e-commerce marketplace for game currencies, accounts, skins, and digital goods. Built with **Next.js 16**, **TypeScript**, and **TailwindCSS 4**. Features a **JSON file-based database** for zero-configuration local development.

## 🚀 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), React 19, TailwindCSS 4, Framer Motion, Zustand |
| Backend | Next.js API Routes, TypeScript |
| Database | JSON file-based storage (zero external dependencies) |
| Auth | JWT with refresh tokens |
| Forms | React Hook Form + Zod validation |
| Testing | Jest + Testing Library (unit), Playwright (E2E) |

> **Why JSON Database?** No external database server required. Perfect for local development, demos, and small-scale deployments. Data is stored in `./data/` directory as simple JSON files.

---

## 📋 Prerequisites

- **Node.js 20+** — [Download](https://nodejs.org/)
- **npm** — Bundled with Node.js

> **No Docker, No MySQL, No Redis Required!** The JSON database runs without any external services.

---

## 🛠️ Quick Start Guide

### Step 1 — Clone & Install

```powershell
git clone <your-repo-url>
cd leiz-store
npm install
```

### Step 2 — Configure Environment

Copy the example environment file (or the default `.env` is already configured for local dev):

```powershell
# The .env file is pre-configured for local development
# No changes needed to get started
```

Key variables in `.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | `dev-secret-change-in-production` | **Change this in production!** |
| `JWT_EXPIRES_IN` | `15m` | Access token lifetime |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh token lifetime |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Public URL of the app |

### Step 3 — Seed the Database

Populate the JSON database with sample data (products, users, orders):

```powershell
npm run seed
```

This creates JSON files in the `./data/` directory with:
- 8 customer users
- 1 product category
- 8 products with images
- 30 sample orders
- Testimonials, FAQs, and settings

### Step 4 — Start Development Server

```powershell
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)** in your browser.

✅ **That's it!** No database configuration, no Docker, no MySQL setup required.

---

## 🔐 Default Login Credentials

After running `npm run seed`, you can login with:

| Email | Password | Role |
|-------|----------|------|
| gamerpro@email.com | customer123 | Customer |

---

## 📦 Common Commands

```powershell
# Start development server
npm run dev

# Seed the JSON database
npm run seed

# Build for production
npm run build

# Start production server (requires build first)
npm start

# Type check
npm run typecheck

# Run linter
npm run lint

# Fix lint issues automatically
npm run lint:fix

# Run unit tests
npm test

# Run unit tests with coverage report
npm run test:coverage

# Run E2E tests (requires dev server running)
npm run e2e

# Run E2E tests with UI
npm run e2e:ui
```

---

## 🏭 Production Build

```powershell
# 1. Set environment variables (edit .env or set via your host)
#    - Set JWT_SECRET to a strong random string
#    - Set NEXT_PUBLIC_SITE_URL to your domain

# 2. Seed the database
npm run seed

# 3. Build the application
npm run build

# 4. Start the production server
npm start
```

The app builds to `standalone` output mode, suitable for Docker or any Node.js host.

---

## 📁 Project Structure

```
leiz-store/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── page.tsx           # Home page
│   │   ├── layout.tsx         # Root layout
│   │   ├── products/          # Product catalog & detail pages
│   │   ├── checkout/          # 4-step checkout flow
│   │   ├── auth/              # Login & register
│   │   ├── wishlist/          # Saved items
│   │   ├── track/             # Order tracking
│   │   └── api/               # REST API route handlers
│   ├── components/            # React components
│   │   ├── layout/            # Navbar, Footer
│   │   ├── product/           # ProductCard, ProductFilters
│   │   └── cart/              # CartDrawer
│   ├── stores/                # Zustand state stores
│   │   ├── auth-store.ts
│   │   ├── cart-store.ts
│   │   ├── locale-store.ts
│   │   └── theme-store.ts
│   ├── lib/
│   │   ├── json-db.ts         # JSON database engine (Prisma-compatible API)
│   │   ├── prisma-types.ts    # TypeScript type definitions
│   │   ├── repositories/      # Data access layer
│   │   ├── services/          # Business logic layer
│   │   ├── auth.ts            # JWT helpers
│   │   ├── currency.ts        # Dual-currency (IDR/USD)
│   │   ├── notifications.ts   # Multi-channel notifications
│   │   └── qris.ts            # QRIS payment integration
│   └── types/                 # TypeScript types
├── data/                      # JSON database files (gitignored, created by seed)
│   ├── user.json
│   ├── product.json
│   ├── order.json
│   └── ...
├── scripts/
│   └── seed-json.ts           # Database seeder
├── e2e/                       # Playwright E2E tests
│   └── smoke.spec.ts
├── next.config.ts             # Next.js configuration
├── tsconfig.json              # TypeScript configuration
├── playwright.config.ts       # Playwright configuration
└── .env                       # Environment variables
```

---

## 🎨 Features

### Customer Features
- 🛒 **Shopping Cart** — Persistent cart with mini drawer
- 💳 **4-Step Checkout** — Customer info → Review → Payment → Confirmation
- 🔍 **Product Catalog** — Search, filter by category, sort by price/name
- ❤️ **Wishlist** — Save favorite products
- 📍 **Order Tracking** — Track order status in real-time
- 📱 **Responsive** — Works on all devices

### Payment Methods
- QRIS
- DANA
- OVO
- GoPay
- Bank Transfer

---

## 💾 JSON Database Architecture

The project uses a custom JSON database engine ([src/lib/json-db.ts](src/lib/json-db.ts)) that provides a Prisma-compatible API without requiring any database server.

### How It Works
- **Data Storage**: Each model is stored as a JSON file in `./data/` directory
- **Auto-Reload**: Files are reloaded on each query for hot-reload support
- **Transactions**: Simplified transaction support via sequential execution
- **Type Safety**: Full TypeScript support via [src/lib/prisma-types.ts](src/lib/prisma-types.ts)

### Supported Operations
- `findMany()`, `findUnique()`, `findFirst()`
- `create()`, `createMany()`, `upsert()`
- `update()`, `updateMany()`
- `delete()`, `deleteMany()`
- `count()`, `groupBy()`, `aggregate()`
- Relations (include nested models)
- Where filters (equals, contains, in, gt, lt, etc.)

### Backing Up Data
Simply copy the `./data/` directory to backup all data:

```powershell
# Backup
xcopy data data-backup /E /I

# Restore
xcopy data-backup data /E /I
```

---

## 🎨 Design System

| Token | Value |
|-------|-------|
| Primary | #7C3AED |
| Secondary | #A855F7 |
| Accent | #EC4899 |
| Background | #0F172A |
| Surface | #1E293B |

---

## 🧪 Testing

### Unit Tests

```powershell
# Run all unit tests
npm test

# Run with coverage (requires 60% branches/functions, 70% lines)
npm run test:coverage

# Watch mode during development
npm run test:watch
```

Coverage is collected from `src/lib/**/*.ts` and `src/stores/**/*.ts`.

### E2E Tests

```powershell
# Make sure the dev server is running first
npm run dev

# In another terminal, run E2E tests
npm run e2e

# Interactive UI mode
npm run e2e:ui

# Debug mode
npm run e2e:debug
```

E2E smoke tests cover: homepage, products page, navigation, login page, and checkout auth guard.

---

## 🔔 Optional Integrations

The following integrations are **disabled by default**. Uncomment the relevant variables in `.env` to enable:

### Telegram Notifications
```env
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

### Discord Notifications
```env
DISCORD_WEBHOOK_URL=your_webhook_url
```

### WhatsApp Notifications
```env
WHATSAPP_API_KEY=your_api_key
WHATSAPP_API_URL=your_api_url
```

### QRIS Payment Webhook
```env
QRIS_WEBHOOK_SECRET=your_webhook_secret
```

---

## ⚠️ Troubleshooting

### Port 3000 already in use
```powershell
# Find process using port 3000
netstat -ano | findstr :3000

# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F
```

Next.js will automatically use the next available port (3001, 3002, ...) if 3000 is taken.

### TypeScript errors
```powershell
# Verify types
npm run typecheck

# Ensure all dependencies are installed
npm install
```

### Database errors / missing data
```powershell
# Re-seed the database
npm run seed

# Check the ./data/ directory exists and has JSON files
dir data
```

### Build errors
```powershell
# Clear Next.js cache and rebuild
Remove-Item -Recurse -Force .next
npm run build
```

### `data/` directory is empty after seeding
The `./data/` directory is gitignored. Run `npm run seed` any time you need to repopulate data after a fresh clone.

---

## 📜 License

This project is licensed under the MIT License.

---

Built with ❤️ by LEIZ STORE
