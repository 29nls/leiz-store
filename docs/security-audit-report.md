# 🔐 Security Audit Report — LEIZ STORE

| | |
|---|---|
| **Target** | LEIZ STORE (Next.js 16 / TypeScript / Supabase / Postgres) |
| **Date** | 2026-08-05 |
| **Methodology** | OWASP Top 10 (2021) · manual code review of frontend, API routes, auth, services, RLS, and deployment config |
| **Auditor** | Application Security Engineer (AI-assisted) |

---

## 1. Executive Summary

LEIZ STORE's **payment/checkout integrity core is well engineered** — server-side pricing authority, atomic stock handling, idempotency with encrypted replay tokens, order-scoped confirmation tokens, and magic-byte-validated payment-proof uploads are all handled correctly. The real exposure is at the **edges**: Discord-button authorization, anon INSERT grants in Row-Level Security, PII leakage through the unauthenticated tracking endpoint, and missing rate limits on sensitive endpoints.

**Verdict: 2 High (both remediated ✅), 4 Medium (all remediated ✅), 4 Low findings.** The two High findings and all four Medium findings were fixed on 2026-08-05 (see remediation notes below); the Low items remain open.

| Severity | Count | Status |
|---|---|---|
| 🔴 High | 2 | ✅ Remediated 2026-08-05 |
| 🟠 Medium | 4 | ✅ All Remediated 2026-08-05 |
| 🟡 Low | 4 | ⏳ Open |

> **Remediation log**
> - **2026-08-05 — HIGH-1 remediated:** `api/discord/interactions/route.ts` now requires the clicking member to hold `DISCORD_ADMIN_ROLE_ID` and fails closed when the env var is unset. `.env.example` documents the new var; tests updated/added in `interactions.test.ts`. Signature verification unchanged.
> - **2026-08-05 — HIGH-2 remediated:** anon INSERT policies (`"Insert order"`, `"Insert order_item"`, `"Insert payment"`) removed from `scripts/supabase-schema.sql`, with `scripts/migrations/010_revoke_anon_inserts.sql` shipping the same DROPs (plus a self-check) for existing deployments. Verified beforehand that every `order`/`order_item`/`payment` write flows through `service_role` (`create_order_atomic` RPC + `supabaseAdmin` API routes); the browser/anon client only reads those tables.
> - **2026-08-05 — MED-3 remediated:** `createOrderSchema` now caps `items` at 20 line items (`.max(20)`) and constrains `paymentMethod` to `z.enum([...MANUAL_PAYMENT_METHODS])` = `bank_transfer | gopay | dana`. Regression tests added in `src/app/api/orders/__tests__/route.test.ts`.
> - **2026-08-05 — MED-4 remediated:** all PostgREST `.or()` search interpolations now percent-encode the user term via the shared `buildIlikeOrFilter()` helper (`src/lib/supabase-search.ts`) — applied to `/api/admin/orders`, `/api/admin/products`, `/api/admin/users`, and the client-side admin orders table. Unit tests in `src/lib/__tests__/supabase-search.test.ts`.
> - **2026-08-05 — MED-1 remediated:** `track?orderId=` reads now require the order-scoped confirmation cookie (path broadened to `/api/orders` so the same httpOnly token authorizes reads and confirms). Order-number reads keep working anonymously — the order number is the bearer credential there — and its generator was switched from `Math.random()` to a CSPRNG (`crypto.randomInt`) after review found the old suffix was non-cryptographic (see MED-1 section for the corrected severity). Tests in `src/app/api/orders/track/__tests__/route.test.ts` and `src/lib/__tests__/order-number.test.ts`.
> - **2026-08-05 — MED-2 remediated:** brute-force protection added to `/api/admin/login` (dual buckets: 20 attempts/IP + 10 attempts/account per 15 min; only failures count, success resets; fail-open via `safe*` wrappers; windows auto-expire — no permanent lockout) and `POST /api/orders` (20 orders/IP per 60 s, fail-open). See MED-2 section for the full design incl. IP trust model. Tests in `middleware.test.ts` and a new login-route test file.

---

## 2. Scope & Attack Surface Reviewed

- **Frontend:** `src/app/**` (pages, admin shell), `src/components/**` (ProductCard, OptimizedImage, third-party scripts), `src/stores/**` — XSS, CSRF
- **Backend:** `src/app/api/**` (orders, confirm, track, payments, admin CRUD, login, verify, logout, discord interactions, upload, settings, stats, cron), `src/lib/**` (auth, admin-auth, payment-service, order-service, order-idempotency, repositories, validators) — SQLi, auth flaws, API abuse
- **Database:** `scripts/supabase-schema.sql`, `scripts/migrations/005…008` — RLS, grants, SECURITY DEFINER functions
- **Deployment:** `next.config.ts`, `Dockerfile`, `docker-compose.yml`, `Caddyfile`, `.github/workflows/ci.yml`, `.env.example`

---

## 3. Findings

### 🔴 HIGH-1 — Discord buttons execute admin payment actions without any authorization check

**OWASP:** A01 Broken Access Control

**Location:** `src/app/api/discord/interactions/route.ts` (MESSAGE_COMPONENT handler) → `processAction()` → `adminAcceptPayment / adminRejectPayment / adminCancelOrder / adminForceCancelOrder`

**Detail:**
The endpoint correctly verifies Discord's ed25519 signature (`verifyKey`), which proves the request is a *genuine Discord interaction* — but it never verifies that **the clicking user is authorized to perform admin actions**. The clicker's ID is recorded as `adminId` in the audit log, but **any member of the Discord server who can see (or is sent a link to) the seller-channel message can click the buttons** and:

- accept/reject a buyer's payment (`PENDING_PAYMENT → PAID`),
- cancel / force-cancel any order,
- trigger buyer DMs that impersonate the store,
- queue invoice generation.

`DISCORD_ADMIN_SECRET` exists in `.env.example` and is enforced in `/api/admin/payment-action`, but **not** in the interactions handler — the actual Discord click path.

**Proof (code):**
```ts
const interactionUser = interaction.member?.user ?? interaction.user;
const adminId = interactionUser?.id ?? "discord_admin";   // no role check
...
const messageData = await processAction(action, orderId, adminId, adminTag, ...);
```

**Fix (recommended):**
1. Require a configured admin role: `const ADMIN_ROLE_ID = process.env.DISCORD_ADMIN_ROLE_ID` and check `interaction.member?.roles` contains it; otherwise reply ephemeral `❌ Kamu tidak punya akses admin` and do nothing.
2. (Alternative/defense-in-depth) Require `interaction.authorizing_integration_owners` (server owner) or an allowlist env var `DISCORD_ADMIN_USER_IDS`.
3. Keep the audit log (already present) and add an explicit `unauthorized_attempt` log.

**✅ REMEDIATED (2026-08-05):** role check implemented — `DISCORD_ADMIN_ROLE_ID` env var, member-role verification with fail-closed denial (including when the var is missing), ephemeral denial messages, and a distinct unauthorized-attempt log. Documented in `.env.example`; tests added/updated in `src/app/api/discord/__tests__/interactions.test.ts`. Signature verification untouched.

---

### 🔴 HIGH-2 — Anonymous RLS policies allow forging orders / items / payments via the public API

**OWASP:** A01 Broken Access Control · A02 Cryptographic/Integrity Failures (data integrity)

**Location:** `scripts/supabase-schema.sql`

**Detail:**
```sql
CREATE POLICY "Insert order"     ON public.order      FOR INSERT WITH CHECK (true);
CREATE POLICY "Insert order_item" ON public.order_item FOR INSERT WITH CHECK (true);
CREATE POLICY "Insert payment"   ON public.payment    FOR INSERT WITH CHECK (true);
```
The anon key is public (shipped to browsers). Anyone can call the Supabase REST API directly with the anon key and insert **arbitrary `order` / `order_item` / `payment` rows** — fabricated totals, statuses, and customer data — bypassing the server-side pricing, stock, and idempotency logic entirely. This pollutes the admin dashboard, invoice queue, and analytics, and enables low-effort spam/flooding of operational data.

**Note:** anon cannot `UPDATE`/`DELETE` (no such policies), so forged orders can't be marked PAID directly — but the integrity impact is still real (fake orders + fake payments shown to admins).

**Fix:**
```sql
DROP POLICY IF EXISTS "Insert order"     ON public.order;
DROP POLICY IF EXISTS "Insert order_item" ON public.order_item;
DROP POLICY IF EXISTS "Insert payment"   ON public.payment;
```
All legitimate writes already go through the server (`supabaseAdmin` / service_role via `create_order_atomic`). If guest self-service inserts are ever needed, wrap them in a validating `SECURITY DEFINER` RPC with `REVOKE ... FROM PUBLIC; GRANT EXECUTE ... TO service_role` (as done for `create_order_atomic`).

**✅ REMEDIATED (2026-08-05):** the three anon INSERT policies were removed from `scripts/supabase-schema.sql` (with the DROP statements recorded for existing deployments). The claim was verified before removal — all `order`/`order_item`/`payment` writes use `supabaseAdmin` (service_role) or the `create_order_atomic` RPC; browser/anon client code only reads those tables.

---

### 🟠 MED-1 — Public order-tracking endpoint leaks customer PII without authentication

**OWASP:** A01 Broken Access Control · A02 (Sensitive Data Exposure)

**Location:** `src/app/api/orders/track/route.ts` (orderId branch)

**Detail:**
`GET /api/orders/track?orderId=<id>` returns, with **no token/cookie requirement**:

```ts
const safeOrderData = {
  id, order_number, customer_name, buyer_discord_id,
  customer_discord, total, currency, payment_method, status,
  expiry_at, confirmed_at, created_at, order_item, items, orderItem,
};
```

The 25-char random order ID is the *only* barrier, and it lives in the URL — leaked via browser history, Referer headers, logs, and screenshots. The order-scoped confirmation token (httpOnly cookie) exists precisely to gate this flow but is **only enforced on the confirm endpoint**, not on reads. Anyone holding or guessing an order URL can harvest the buyer's real name and Discord ID.

**Fix:**
1. For `orderId` reads, require the `payment_confirmation_{orderId}` cookie **or** the token (same check as `confirm`), and return `401` otherwise.
2. In the anonymous `orderNumber` branch, don't return `customerDiscord`/`buyerDiscordId` (currently `undefined` — good); keep `customerName` masked (e.g. first name + initial) if it must stay.
3. Set the payment cookie with a broader `path: "/"` (or also `"/api/orders/track"`) so legitimate reads work, while keeping it httpOnly + SameSite=Lax.

**✅ REMEDIATED (2026-08-05):**

*Mechanism (least-invasive combination).* The confirmation cookie that checkout already issues is now the read credential too:

1. **Broadened the cookie path** from `/api/orders/{id}/confirm` to `/api/orders` in `src/app/api/orders/route.ts` (and stopped clearing it after confirm in `confirm/route.ts` — the payment page keeps polling `track` after confirming, so a refresh must still be authorized). The cookie remains httpOnly + SameSite=Lax + per-order-named, so it is invisible to JS and only ever grants access to its own order.
2. **Gated the `orderId` branch** in `src/app/api/orders/track/route.ts`: `track?orderId=` now requires `payment_confirmation_{orderId}` and validates it against the stored SHA-256 token hash via the existing `validateTransferToken()`. Missing or invalid → uniform **404** (not 401) with the same generic body as a missing order — **no PII and no order-existence oracle**. The `orderNumber` branch is unchanged and still masks `customerDiscord`/`buyerDiscordId`.
3. **Order numbers = the bearer credential on the manual path.** The anonymous `orderNumber` lookup intentionally requires nothing beyond the number itself: the buyer holds it from checkout/Discord (never emailed). The response excludes contact identifiers (`customerDiscord`/`buyerDiscordId`) and now also masks the customer name to "First L." (`maskCustomerName` in the route) — the `/track` page never renders the name, so legitimate buyers are unaffected. This keeps the public `/track` page working on any device.

*Order-number severity finding (corrected).* `LZ-{date}-{6 base36}` suffixes were generated with **`Math.random()`** — a non-cryptographic PRNG — in `services/index.ts`, and could even produce suffixes shorter than 6 characters (failing the route's own format check). The date prefix is sequential by day, but the suffix is random, so order numbers are **not enumerable in practice** (36⁶ ≈ 2.2B values, plus the 10 req/min/IP track rate limit). Still, a predictable PRNG weakens the bearer-credential assumption, so the generator was moved to a dedicated server-only module (`src/lib/order-number.ts`) using **`crypto.randomInt`** and is now used by `orderService.create`; the dead `Math.random()` copy in `utils.ts` was removed. This is defense-in-depth (severity remains Medium, not elevated to High: no practical enumeration path).

*Regression check.* Post-checkout `/payment/[orderId]` (same browser, cookie present) works; manual `/track` by order number works with no cookie; post-confirm refreshes/polling still authorized because the cookie persists until order expiry (24 h).

**🔍 Investigation notes (2026-08-05, read-only — superseded by the remediation above):**

*How a buyer reaches tracking:* there are exactly two entry points, and **no confirmation email or Discord DM contains a tracking link**. (1) The public `/track` page (Navbar link + homepage CTA) — the buyer types their **order number** (`LZ-…`) manually → `GET /api/orders/track?orderNumber=…`. (2) Immediately after checkout the app redirects to `/payment/[orderId]`, which fetches `GET /api/orders/track?orderId=…` for payment instructions. The buyer-facing Discord DM (`buildBuyerEmbed`) carries only the order number + message; the email channel is a `console.log` placeholder — so tracking is entirely self-service by order number, or the payment URL right after checkout.

*Is `orderId` guessable?* No. IDs are `crypto.randomUUID()` truncated to 25 hex chars (~100 bits of CSPRNG entropy), the route enforces `^[a-zA-Z0-9_-]{8,64}$`, and the endpoint is rate-limited (10 req/min/IP). Enumerating or guessing IDs is not practical.

*What breaks if reads required the confirmation token?* The confirmation token is an **httpOnly cookie path-scoped to `/api/orders/{id}/confirm`** — it is invisible to JS and is not sent to `/api/orders/track` on a different path. Requiring it for `track?orderId=` reads would therefore **break the buyer's own post-checkout payment page** (the one legit client of the orderId branch) and would lock out buyers who re-check later by order number. A fix must ship a companion mechanism — e.g. broaden the cookie path, or issue a signed short-lived track URL/token at checkout — before the read gate can be enabled. Recommended next step: gate orderId reads while keeping `orderNumber` anonymous (it already masks `customerDiscord`/`buyerDiscordId`), then decide whether orderNumber reads should be masked further (e.g. first name + initial).

---

### 🟠 MED-2 — No brute-force protection on admin login; no rate limit on order creation

**OWASP:** A07 Identification & Authentication Failures · A04 (DoS)

**Location:** `src/app/api/admin/login/route.ts`, `src/app/api/orders/route.ts`

**Detail:**
- `/api/admin/login` performs no rate limiting, despite `checkRateLimit()` existing in `src/lib/middleware.ts`. An attacker can brute-force `ADMIN_EMAIL`/`ADMIN_PASSWORD` (legacy path) or the Supabase Auth password unlimited.
- `POST /api/orders` (unauthenticated by design) has **no** rate limit → unlimited order spam, DB churn (each order locks product rows), and Discord/DM spam on confirmation.

**Fix:**
1. `checkRateLimit("admin-login:" + ip + ":" + email, 5, 15 * 60 * 1000)` in the login route; return 429 with headers.
2. `checkRateLimit("order-create:" + ip, 10, 60000)` in the orders route.
3. **Note (both):** the in-memory store resets on restart, is not shared across serverless instances, and `getClientIp` trusts the first `X-Forwarded-For` value, which clients can spoof. For real protection use a Redis/KV-backed limiter and pin IP extraction to your trusted proxy (or hash IP + fingerprint together so spoofing one value isn't enough).

**✅ REMEDIATED (2026-08-05):**

*Design.* Both limits reuse the existing in-memory store (`rateLimitStore` in `src/lib/middleware.ts`) with new fail-open helpers and generous thresholds, documented in code and this report.

- **Admin login — dual buckets, fail-open:** `LOGIN_RATE_LIMIT` = **20 failed attempts per IP** + **10 failed attempts per account** per **15 min**. The flow: `safePeekRateLimit` on both keys before attempting; on failure, both buckets are recorded via `safeCheckRateLimit`; on success both are reset. Only *failed* attempts count, so a legitimate admin's typos don't exhaust the budget, and a successful login clears the counters. Windows auto-expire (no permanent lockout); `Retry-After` is returned on 429. The **per-account bucket is the backstop against IP rotation/spoofing** — rotating `X-Forwarded-For` still hits the account cap. All calls go through `safe*` wrappers that **fail open** (a limiter bug degrades to no-limit, never a lockout).
- **Order creation — per-client, fail-open:** `ORDER_CREATE_RATE_LIMIT` = **20 orders per IP per 60 s** — generous enough that buyers behind shared NAT IPs are unaffected, but scripted flooding (which produces dozens of orders per second) is stopped with a 429.
- **IP trust model (audited):** in the Docker deployment only the Caddy reverse proxy publishes ports and Caddy *replaces* any client-supplied `X-Forwarded-For` with the real peer IP, so the first XFF value is trustworthy; on Vercel the edge likewise sets it. `getClientIp` was hardened (trim + length cap, fall back to `unknown`) and its trust model documented in a comment. Only a direct-exposure deployment (no proxy) can spoof XFF — covered by the per-account bucket. A Redis/KV-backed limiter remains recommended for multi-instance serverless, as noted in the original finding.

*Tests.* `middleware.test.ts`: peek-doesn't-increment, failure accumulation → blocked, lockout expiry restores access, reset clears, fail-open wrappers, order-cap boundary. New `src/app/api/admin/login/__tests__/route.test.ts`: repeated failed logins → 429, IP-rotation backstop → 429, lockout expiry restores, success resets counters, missing credentials → 400. `route.test.ts` (orders): order flood → 429 while legitimate orders still pass. Full suite green (385 tests), lint + typecheck clean.

---

### 🟠 MED-3 — Unbounded `items` array and free-form inputs in order creation

**OWASP:** A04 Insecure Design (resource exhaustion)

**Location:** `src/lib/validators/order.ts` → `createOrderSchema`

**Detail:**
```ts
items: z.array(z.object({ productId: z.string().min(1), quantity: z.number().int().min(1).max(999) }))
  .min(1, "At least one item is required"),   // ← no .max()
paymentMethod: z.string().min(1, "Payment method is required"), // ← free string
```
An attacker can POST hundreds/thousands of line items; `create_order_atomic` then locks and re-selects every product inside the transaction, enabling cheap DoS. `paymentMethod` should be an enum matching `PAYMENT_ACCOUNTS` to keep the data model closed.

**Fix:** `.min(1).max(20)` on `items`; `z.enum([...])` for `paymentMethod`; add a route-level body-size cap (Next.js `serverActions` cap exists but API routes need their own check).

**✅ REMEDIATED (2026-08-05):** `items` now has `.min(1).max(20)` (20 chosen because it is well above any realistic cart for this ~20–40 SKU catalog while bounding the RPC's per-item row locks; no existing business limit was found in the codebase), and `paymentMethod` is `z.enum([...MANUAL_PAYMENT_METHODS])` — the exact set the checkout and payment pages support (`bank_transfer`, `gopay`, `dana`). Behavior for legitimate clients is unchanged (they only ever send those values). Regression tests added for over-limit items, the exact-20 boundary, and an unsupported method. A route-level body-size cap remains open as a Low/defense-in-depth item.

---

### 🟠 MED-4 — PostgREST filter injection via interpolated `.or()` search strings

**OWASP:** A03 Injection

**Location:** `src/app/api/admin/orders/route.ts` (`.or("order_number.ilike.%${search}%,...")`), `src/app/api/admin/products/route.ts` (same pattern)

**Detail:**
Search values are interpolated into PostgREST's logical-filter string. Values containing commas, quotes, or parentheses are parsed as filter **syntax**, not just data — e.g. a search of `x,status.eq.PAID` alters the filter expression. RLS still bounds what can be read, and this is admin-only today, but malformed values can also produce 400s/log noise and break the query builder's expectations.

**Fix:** pass values as parameters instead of string interpolation:
```ts
query = query.ilike("order_number", `%${search}%`).or(`customer_name.ilike.%${search}%`);
```
or use the PostgREST `and()`/`or()` with properly quoted values (`"value"`).

**✅ REMEDIATED (2026-08-05):** the search term is now percent-encoded before interpolation via the shared `buildIlikeOrFilter(columns, term)` helper (`src/lib/supabase-search.ts`), which emits e.g. `order_number.ilike.%x%2Cstatus.eq.PAID%,…`. Commas, parentheses, quotes and `and(`/`or(`/`not.` prefixes in user input become inert URL-encoded data (PostgREST decodes the value portion), so they can no longer alter the filter expression. Applied to all four interpolation sites found by a codebase-wide search: `/api/admin/orders`, `/api/admin/products`, `/api/admin/users`, and the client-side admin orders table. The `buildFilters` path in `src/lib/supabase-db.ts` already used this encoding and is unchanged.

---

### 🟡 LOW-1 — Legacy JWT admin path doesn't re-validate DB profile; non-constant-time comparisons

**OWASP:** A07 Identification & Authentication Failures

**Location:** `src/lib/admin-auth.ts`, `src/lib/auth.ts`, `src/app/api/admin/login/route.ts`

**Detail:**
- `authenticateAdmin()` accepts any legacy JWT with `role === "ADMIN"` without checking the email still maps to an active ADMIN row in `public.user` (the Supabase path does check `is_active`; the legacy path doesn't).
- `verifyJWT()` compares HMAC signatures with `signature !== expectedSig` — not constant-time.
- The legacy login fallback compares `password !== ADMIN_PASSWORD` with `!==` — a (theoretical) timing side-channel, and it distinguishes "credentials not configured" (503-style messages) which aids enumeration.

**Fix:** `crypto.timingSafeEqual` for both comparisons (decode buffers first, guard length); in the legacy JWT path, also look up the profile by email and reject deactivated users. Remove the "credentials not configured" differentiation in error text.

---

### 🟡 LOW-2 — CORS responses may emit `*` with credentials on error paths

**OWASP:** A05 Security Misconfiguration

**Location:** `src/lib/middleware.ts` → `corsHeaders()`

**Detail:**
`corsHeaders()` returns `Access-Control-Allow-Origin: *` when `origin` is falsy, while `Access-Control-Allow-Credentials: true` is always set. Browsers reject `*` + credentials, but several error responses call `corsHeaders()` without an origin, and the allowlist logic is loose. If `CORS_ORIGINS` is misconfigured (e.g. left as the default `http://localhost:3000`), the API reflects no cross-origin access at all in production.

**Fix:** default `Access-Control-Allow-Origin` to `""` unless a whitelisted origin is present; validate `CORS_ORIGINS` at startup; never combine `*` with credentials.

---

### 🟡 LOW-3 — Admin image upload trusts client MIME type (no magic-byte check)

**OWASP:** A03 Injection (stored content) · A01 (access control)

**Location:** `src/app/api/admin/upload/route.ts`

**Detail:**
The admin upload validates `file.type` against an allowlist but — unlike `payment-proof-storage.ts` — does **not** verify file signatures (magic bytes). Files are stored in a **public** bucket (`product-images`) and served with the client-declared `content-type`. Admin-only today, but defense-in-depth: reject a JPEG that is actually an HTML/SVG polyglot so the bucket can never serve active content even if content-type handling changes.

**Fix:** reuse `hasValidPaymentProofSignature()`-style magic-byte validation; serve with a fixed `content-type` and `Content-Disposition` derived from the validated extension.

---

### 🟡 LOW-4 — `public.setting` is world-readable and admin-writable with free-form keys

**OWASP:** A01 Broken Access Control · A05

**Location:** `scripts/supabase-schema.sql` ("Public read" on `setting`), `src/app/api/admin/settings/route.ts`

**Detail:**
Settings are readable by anonymous users and `PUT /api/admin/settings` accepts arbitrary `key`/`value`/`group`. Fine today (store config only), but there is no guard against an admin (or a future bug) storing a secret there — it would immediately be public.

**Fix:** add a comment/policy audit listing disallowed keys; consider an allowlist of setting keys in the API route, and/or move sensitive values to env vars (already the convention).

---

## 4. What's Done Right ✅

- **Server-side pricing & stock authority.** `create_order_atomic` (SECURITY DEFINER, `EXECUTE` granted to `service_role` only) computes totals from the DB, locks product rows in deterministic order, re-checks stock inside the transaction, and rejects duplicate products. Clients can never set prices. ✅
- **Idempotency, done properly.** UUID-v4 key format + 64-hex request fingerprint + advisory-lock serialization + AES-256-GCM encrypted replay token, with `order_idempotency` revoked from anon/authenticated and the unsafe 3-arg RPC overload dropped in migration 008. ✅
- **Payment confirmation tokens.** 32-byte CSPRNG token, stored as SHA-256 hash, verified with `crypto.timingSafeEqual`, delivered as order-scoped httpOnly SameSite=Lax cookies, with a rate-limited confirm endpoint and duplicate-confirmation TOCTOU handling. ✅
- **Payment-proof uploads.** MIME allowlist + magic-byte signature check + ≤5MB cap + private bucket + short-lived signed URLs. ✅
- **RLS on every table**; `public.user` profiles (incl. password hashes) are server/admin-only since migration 005; realtime publication only for admin-relevant reads. ✅
- **JWT discipline.** HMAC-SHA256, hard failure if `JWT_SECRET` is missing in production (no insecure default), 24h expiry. ✅
- **Discord webhook hardening.** ed25519 signature verification, validated path segments for followups, strict `^\d{17,19}$` guard before DMing buyers. ✅
- **Security headers.** CSP (with `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`), HSTS preload, `X-Frame-Options: DENY`, `nosniff`, COOP/CORP, `no-store` on `/api/*`, HSTS on the Caddy proxy too. ✅
- **Secrets handling.** Only `NEXT_PUBLIC_*` enter the Docker build; all server secrets are runtime-only via `env_file`; CI builds images without secrets; `.env.*` gitignored. ✅
- **XSS posture.** React auto-escapes all user data; the only `dangerouslySetInnerHTML` uses are static (SW registration) or env-sourced analytics snippets; image hosts are allowlisted in `next.config.ts`. ✅
- **CSRF posture.** State-changing endpoints accept Bearer tokens (preferred by the admin SPA) and cookie auth uses `SameSite=Lax`; cross-site POSTs don't carry the cookies. Residual risk is low. ✅

---

## 5. Remediation Roadmap

| Priority | Action | Status |
|---|---|---|
| ✅ | HIGH-1: Role-check Discord button clicks (`DISCORD_ADMIN_ROLE_ID`) | Applied 2026-08-05 |
| ✅ | HIGH-2: Drop anon INSERT policies on `order`/`order_item`/`payment` | Applied 2026-08-05 (base schema + `migrations/010_revoke_anon_inserts.sql`) |
| ✅ | MED-3: Cap `items` array (`.max(20)`), enum `paymentMethod` | Applied 2026-08-05 (body-size guard still open as defense-in-depth) |
| ✅ | MED-4: Parameterize `.or()` search values | Applied 2026-08-05 (`buildIlikeOrFilter` at 4 sites) |
| ✅ | MED-1: Gate `track?orderId=` behind the confirmation cookie (path broadened to `/api/orders`); CSPRNG order numbers | Applied 2026-08-05 |
| ✅ | MED-2: Rate-limit admin login + order creation | Applied 2026-08-05 (in-memory, fail-open; Redis-backed recommended for multi-instance serverless) |
| P2 | LOW-1…4: constant-time comparisons, legacy-JWT profile check, CORS default, upload magic bytes, settings key allowlist | ~half day |
| P3 | Add regression tests: unauth Discord interaction → denied; anon REST INSERT → denied; track without cookie → 401 | ~half day |

---

*This report reflects a static code review of the working tree as of 2026-08-05. Live testing (e.g., crafting anon REST inserts against a real Supabase project, replaying Discord interactions) was not performed; RLS and Discord behaviors should be verified against the staging environment.*
