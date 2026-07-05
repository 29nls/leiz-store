# LEIZ STORE — Full Project Context

## Stack
Next.js 16 (App Router) + React 19 + Supabase (PostgreSQL/Auth/Storage/Realtime) + TailwindCSS v4 + TypeScript + Zustand + Framer Motion

## Key Skills (load via `skill()`)
- `design-taste-frontend` — Anti-slop frontend for landing pages, portfolios, redesigns
- `discord-interactions-nextjs` — Discord bots in Next.js serverless (timeouts, file attachments)
- `frontend-design` — Distinctive visual design guidance, typography, aesthetic direction
- `high-end-visual-design` — High-end agency design: fonts, spacing, shadows, card structures
- `leiz-store-invoice` — Invoice system (PDF, queue, cron, admin panel)
- `minimalist-ui` — Clean editorial-style interfaces, warm monochrome, bento grids
- `shadcn` — shadcn/ui component management (add, search, fix, style, compose)
- `supabase` — All Supabase tasks (DB, Auth, Storage, Realtime, RLS, CLI, migrations)
- `supabase-postgres-best-practices` — Postgres perf optimization, schema design, queries
- `ui-ux-pro-max` — Full UI/UX intelligence: 50+ styles, 161 palettes, 57 font pairings

## Env (set in Vercel project settings)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`, `CRON_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- `DISCORD_BOT_TOKEN`, `DISCORD_SELLER_CHANNEL_ID`, `DISCORD_PUBLIC_KEY`
- `INVOICE_STORAGE_BUCKET=invoices`

## Key Patterns
- **Build-safe lazy init**: `auth.ts` (getSecret), `supabase.ts` (Proxy) — jangan eager init runtime secrets
- **Discord sync**: Jangan pakai `after()`/`waitUntil()` — lakukan semua work sebelum return response (batas 3 detik)
- **Supabase ops**: Semua operasi DB server-side pakai `supabaseAdmin` (service role). Admin UI pakai `supabase-browser` (anon key + RLS)
- **Invoice idempotency**: Atomic UPDATE guard `.eq("status", currentStatus)` + `ON CONFLICT DO NOTHING`
- **Admin auth**: Dual — JWT cookie (`/api/admin/login`) + Supabase session (`supabase.auth.signInWithPassword`)

## Payment Flow
```
Buyer checkout → POST /api/orders → PENDING → PENDING_PAYMENT
  → Buyer uploads proof → POST /api/orders/[id]/confirm → WAITING_CONFIRMATION
  → Discord embed sent to seller channel (rich embed + 4 action buttons)
  → Admin clicks Accept → status=PAID → invoice generated → stored in Supabase Storage
```

### Order State Machine (13 statuses)
```
PENDING → PENDING_PAYMENT → WAITING_CONFIRMATION → PAID → PROCESSING → COMPLETED
                         → EXPIRED / CANCELLED / FORCE_CANCELLED
         → REJECTED / NEEDS_REVIEW
```

## Discord Integration
- **HTTP Interactions** (no WebSocket) — ed25519 signature verification
- **Buttons**: `payment_accept|reject|cancel|force_cancel_{orderId}`
- **Response**: Type 7 (UPDATE_MESSAGE) — synchronous DB update + embed rebuild (~300ms)
- **Buyer DM**: Fire-and-forget after response
- **Invoice trigger**: on payment_accept → `generateAndSendInvoice()` async

## Payment Accounts (constants.ts)
- **Bank Jago**: 103343988197 a.n. Ridho Kurniawan
- **GoPay / DANA**: 085942180995 a.n. Ridho Kurniawan

## Database (25+ tables)
- **Core**: store, user, category, product, product_image, testimonial, faq, banner
- **Order**: order, order_item, payment, payment_confirmation, order_log, wishlist
- **Invoice**: invoice, whatsapp_queue, job_queue (migration 003)
- **Analytics**: analytics_event, sales_forecast, customer_segment, product_recommendation
- **Support**: setting, activity_log, inventory_log, stock_alert, notification, currency_rate, refresh_token
- **RLS**: All tables have RLS. Admin gated by `public.is_admin()` (checks auth.email() → user.role = ADMIN)

## Admin Routes
| Path | Description |
|------|-------------|
| `/admin` | Dashboard (stats, recent orders, low stock) |
| `/admin/login` | Login (Supabase Auth + JWT cookie fallback) |
| `/admin/products` | Product CRUD |
| `/admin/categories` | Category management |
| `/admin/orders` | Order listing + detail |
| `/admin/users` | User management |
| `/admin/invoices` | Invoice listing + resend |
| `/admin/settings` | Store settings |

## API Routes (key ones)
| Path | Method | Purpose |
|------|--------|---------|
| `POST /api/orders` | POST | Create order + deduct stock |
| `POST /api/orders/[id]/confirm` | POST | Confirm payment → Discord notification |
| `GET /api/orders/track` | GET | Public order tracking |
| `POST /api/discord/interactions` | POST | Discord button handler |
| `POST /api/admin/login` | POST | JWT cookie login |
| `POST /api/admin/payment-action` | POST | Alt payment action (x-admin-secret) |
| `GET /api/admin/invoices` | GET | List invoices |
| `GET /api/cron/process-jobs` | GET | Process invoice queue (120s, CRON_SECRET) |
| `POST /api/payments/expire` | POST | Expire overdue orders (cron) |

## Tests
`npm test` — 292 tests (Jest, 16 suites). E2E: `npm run e2e` (Playwright).

## CI/CD
GitHub Actions: lint → typecheck → test → build → E2E. CodeQL + MSDO + njsscan.

## Important Files
- `src/lib/payment/payment-service.ts` — Core payment logic with atomic status guards
- `src/lib/invoice/invoice-service.ts` — Invoice orchestration
- `src/lib/queue/queue-service.ts` — Job queue with retry
- `src/lib/discord/bot.ts` — Discord API calls (seller embed, buyer DM)
- `src/lib/supabase.ts` — Lazy-init Supabase clients (Proxy pattern)
- `src/lib/auth.ts` — Zero-dep JWT + PBKDF2 password hashing
- `src/lib/supabase-db.ts` — Prisma-compatible database adapter (1106 lines)
- `src/lib/prisma-types.ts` — Type definitions (742 lines)
- `src/lib/repositories/index.ts` — Repository layer (703 lines)
- `src/lib/services/index.ts` — Service layer (991 lines)
- `src/lib/notifications.ts` — Multi-channel notifications
- `scripts/migrations/003_invoice.sql` — Invoice + queue tables migration
- `vercel.json` — CRON `*/5 * * * *` for process-jobs
