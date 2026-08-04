# Order and Payment Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove payment tokens from URLs, make keyed order retries idempotent, isolate post-commit side effects, and prove the payment/order flow with focused tests.

**Architecture:** Keep the existing Supabase `create_order_atomic` RPC as the transaction boundary for order rows and stock. Add an idempotency record and encrypted token replay data to that same database boundary, expose the raw token only through an order-scoped HttpOnly cookie, and keep the public order response token-free. Use a deterministic request fingerprint to distinguish safe retries from key reuse with changed data.

**Tech Stack:** Next.js App Router route handlers, TypeScript, Supabase/PostgreSQL RPCs and migrations, Node `crypto`, Zod, Jest, and Playwright.

## Global Constraints

- The `Idempotency-Key` header is optional for backward compatibility; requests without it remain supported without duplicate-request guarantees.
- No application-generated payment URL may contain a raw confirmation token.
- The raw payment token must not appear in JSON responses, logs, analytics, or error messages.
- The atomic database operation remains authoritative for prices, stock, order items, and the stored payment-token hash.
- A committed order must not become a failed checkout response because analytics or order logging fails afterward.
- Confirmation retains rate limiting, token verification, duplicate-confirmation protection, proof validation, and status-transition rules.
- Do not overwrite or stage unrelated working-tree changes in `.github/workflows/ci.yml`, `Dockerfile`, or `package-lock.json` if they reappear during implementation.
- Do not commit unless the user explicitly requests a commit.

---

## File map

### New files

- `src/lib/order-idempotency.ts` — bounded header validation, canonical request fingerprinting, encrypted token replay payloads, and typed idempotency helpers.
- `src/lib/__tests__/order-idempotency.test.ts` — pure helper tests for key validation, fingerprints, encryption/decryption, and tamper/missing-key behavior.
- `scripts/migrations/008_order_idempotency.sql` — idempotency table, indexes, canonical atomic order RPC replacement, and service-role grants.
- `src/app/api/orders/__tests__/route.test.ts` — route contract tests for idempotency header, cookie, public response sanitization, and side-effect failure behavior.
- `src/app/api/orders/[orderId]/confirm/__tests__/route.test.ts` — confirmation route tests for cookie token transport and query-token rejection.
- `src/lib/payment/__tests__/payment-flow.integration.test.ts` — mocked integration coverage for order creation, confirmation, replay, and failure isolation where a live Supabase test database is unavailable.
- `e2e/checkout-payment.spec.ts` — browser-level regression coverage for clean payment URLs and cookie-backed confirmation setup.

### Modified files

- `src/app/checkout/page.tsx` — send an optional stable `Idempotency-Key` and navigate without a token query parameter.
- `src/app/payment/[orderId]/page.tsx` — remove URL-token parsing/state and submit confirmation without a token field.
- `src/app/api/orders/route.ts` — read/validate the idempotency header, call the new service contract, set the scoped cookie, and sanitize the response.
- `src/app/api/orders/[orderId]/confirm/route.ts` — resolve the token from the scoped cookie first and stop accepting query-string tokens.
- `src/lib/services/index.ts` — fingerprint/idempotency-aware order creation and non-fatal post-commit logging/analytics.
- `src/lib/repositories/index.ts` — pass idempotency parameters to the canonical atomic RPC and map replay results.
- `src/lib/validators/order.ts` — make the compatibility body token optional while preserving validation when one is supplied.
- `src/lib/payment/constants.ts` — expose the payment lifetime needed by cookie/idempotency retention code if the existing constant is not already exported for this purpose.
- `src/lib/__tests__/services.test.ts` — update existing order-service mocks/assertions to the new internal result and side-effect behavior.
- `src/lib/payment/__tests__/confirmation-token.test.ts` — retain hash/token coverage and add any compatibility assertions required by the new route contract.
- `scripts/supabase-schema.sql` — document the idempotency table shape if this repository treats the schema file as the install baseline; do not duplicate a conflicting RPC definition.
- `README.md` or the project deployment documentation — document the migration order, cookie behavior, and required encryption secret.

---

## Task 1: Establish pure idempotency and token-replay helpers

**Files:**
- Create: `src/lib/order-idempotency.ts`
- Test: `src/lib/__tests__/order-idempotency.test.ts`

**Interfaces:**
- Produces `validateIdempotencyKey(value: string | null | undefined): string | null`.
- Produces `fingerprintCreateOrderInput(input: CreateOrderFingerprintInput): string`.
- Produces `encryptPaymentToken(token: string): string` and `decryptPaymentToken(payload: string): string`.
- Produces `IDEMPOTENCY_KEY_MAX_LENGTH`, `IDEMPOTENCY_RETENTION_MS`, and the typed `CreateOrderFingerprintInput` interface for later tasks.

- [ ] **Step 1: Write failing tests for key validation and canonical fingerprints.**

```ts
it("accepts a UUID idempotency key and rejects malformed or oversized values", () => {
  expect(validateIdempotencyKey("550e8400-e29b-41d4-a716-446655440000"))
    .toBe("550e8400-e29b-41d4-a716-446655440000");
  expect(validateIdempotencyKey("not-a-key")).toBeNull();
  expect(validateIdempotencyKey("x".repeat(IDEMPOTENCY_KEY_MAX_LENGTH + 1))).toBeNull();
});

it("fingerprints semantically equivalent item ordering identically", () => {
  const base = {
    customerName: "Ada",
    customerDiscord: "ada#1234",
    customerIGN: "ada",
    customerNotes: "gift",
    paymentMethod: "QRIS",
    currency: "IDR",
    items: [{ productId: "p-2", quantity: 1 }, { productId: "p-1", quantity: 2 }],
  };
  const reordered = { ...base, items: [base.items[1], base.items[0]] };
  expect(fingerprintCreateOrderInput(base)).toBe(fingerprintCreateOrderInput(reordered));
});
```

- [ ] **Step 2: Run the focused test to verify it fails.**

Run: `npm test -- --runInBand src/lib/__tests__/order-idempotency.test.ts`
Expected: FAIL because the helper module and functions do not yet exist.

- [ ] **Step 3: Implement deterministic validation and fingerprinting.**

Use `crypto.createHash("sha256")`. Normalize optional strings to trimmed strings, normalize currency/payment method to their submitted canonical values, sort items by `productId`, and serialize a fixed-property object before hashing. Accept UUID v4 keys only, cap the key at 128 characters, and return `null` for absent or invalid values so the route can distinguish “missing” from “malformed.”

- [ ] **Step 4: Write failing tests for authenticated token encryption.**

```ts
it("round-trips the token and rejects tampering", () => {
  process.env.PAYMENT_IDEMPOTENCY_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  const encrypted = encryptPaymentToken("secret-token");
  expect(decryptPaymentToken(encrypted)).toBe("secret-token");
  expect(() => decryptPaymentToken(`${encrypted.slice(0, -2)}aa`)).toThrow();
});

it("fails closed when the encryption key is absent", () => {
  delete process.env.PAYMENT_IDEMPOTENCY_ENCRYPTION_KEY;
  expect(() => encryptPaymentToken("secret-token")).toThrow();
});
```

- [ ] **Step 5: Implement AES-256-GCM replay encryption.**

Read `PAYMENT_IDEMPOTENCY_ENCRYPTION_KEY` as base64-encoded 32 bytes. Generate a fresh 12-byte IV per encryption, include the auth tag, and return a versioned base64url payload in the form `v1.<iv>.<tag>.<ciphertext>`. Reject unsupported versions, invalid lengths, authentication failures, and missing/incorrect key material. Never include the plaintext token in thrown error messages.

- [ ] **Step 6: Run the helper tests.**

Run: `npm test -- --runInBand src/lib/__tests__/order-idempotency.test.ts`
Expected: PASS.

---

## Task 2: Add the database idempotency boundary

**Files:**
- Create: `scripts/migrations/008_order_idempotency.sql`
- Modify: `src/lib/repositories/index.ts`
- Modify: `src/lib/prisma-types.ts` only if compile-time row types require the new internal record
- Test: `src/lib/payment/__tests__/payment-flow.integration.test.ts`

**Interfaces:**
- Repository method becomes `orderRepository.createAtomic(data: { order: Record<string, unknown>; items: Array<{ product_id: string; quantity: number }>; taxRate: number; idempotency?: { key: string; fingerprint: string; encryptedPaymentToken: string } })`.
- It returns `{ order: OrderRecord; replayed: boolean; encryptedPaymentToken: string }` or an equivalent explicit typed result; later service/API tasks must use this shape rather than reading an untyped token from the public response.
- The SQL RPC accepts `p_order JSONB`, `p_items JSONB`, `p_tax_rate NUMERIC`, `p_idempotency_key TEXT DEFAULT NULL`, `p_request_fingerprint TEXT DEFAULT NULL`, and `p_encrypted_payment_token TEXT DEFAULT NULL`.

- [ ] **Step 1: Write the migration contract tests/fixtures before changing the repository.**

Assert the intended database contract in the integration test fixture: same `(scope, key)` plus same fingerprint replays the same order; same key plus a changed fingerprint raises a conflict; two concurrent calls with the same key produce one order and one stock decrement.

- [ ] **Step 2: Run the focused integration test to verify the database contract is unavailable/fails before the migration.**

Run: `npm test -- --runInBand src/lib/payment/__tests__/payment-flow.integration.test.ts`
Expected: FAIL or skip with an explicit missing-test-database message until the migration/RPC fixture is implemented; do not silently mark behavior as passing.

- [ ] **Step 3: Create `order_idempotency` with the uniqueness and lifecycle fields.**

Define:

```sql
CREATE TABLE public.order_idempotency (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'COMPLETED',
  order_id TEXT NOT NULL REFERENCES public."order"(id) ON DELETE CASCADE,
  encrypted_payment_token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT order_idempotency_status_check CHECK (status IN ('COMPLETED')),
  CONSTRAINT order_idempotency_key_length CHECK (char_length(idempotency_key) BETWEEN 1 AND 128),
  CONSTRAINT order_idempotency_fingerprint_length CHECK (char_length(request_fingerprint) = 64),
  CONSTRAINT order_idempotency_scope_key_unique UNIQUE (scope, idempotency_key)
);
```

Add an index on `expires_at`, enable/define the project’s established RLS pattern, revoke public access, and grant access only to `service_role`. Use the existing project naming conventions for quoted `order` identifiers.

- [ ] **Step 4: Replace the old RPC signature with the canonical idempotent signature.**

In the migration, explicitly drop the old three-argument function before creating the five-argument version so PostgreSQL does not retain an unsafe overload. Carry forward the final security/stock logic from migration `006_payment_security.sql`, then add this sequence inside the same transaction:

1. Validate non-null idempotency parameters as a group.
2. Attempt to insert the idempotency row and handle the unique-key race by selecting the existing row `FOR UPDATE`.
3. On an existing row, compare `request_fingerprint`; raise a stable exception such as `idempotency_key_reuse` on mismatch.
4. On a matching row, return the existing order representation and the encrypted token without changing stock.
5. On a new keyed request, lock/check products, calculate totals from locked database prices, reserve stock, insert order/items/inventory logs, then insert the idempotency row referencing the created order before returning it.
6. Preserve the existing no-key behavior for backward compatibility.

Return a JSONB object containing the order record, `replayed` boolean, and encrypted replay token. Do not return the raw token from SQL.

- [ ] **Step 5: Update the repository to call only the canonical RPC and normalize its result.**

Pass the new parameters when `idempotency` is present and pass JSON `null` when absent. Parse the RPC JSONB result, reload the order through the existing Prisma-compatible adapter, and return `{ order, replayed, encryptedPaymentToken }`. Treat missing order data or missing encrypted token on a keyed result as a hard server error.

- [ ] **Step 6: Run SQL lint/fixture checks and the focused integration test.**

Run the project’s available database test command or, if no Supabase test database is configured, run the migration through a disposable test database and then:

```bash
npm test -- --runInBand src/lib/payment/__tests__/payment-flow.integration.test.ts
```

Expected: the same-key replay, changed-payload conflict, and concurrent stock tests pass. Record the unavailable infrastructure rather than weakening the assertions.

---

## Task 3: Make order service idempotency-aware and side-effect-safe

**Files:**
- Modify: `src/lib/services/index.ts`
- Modify: `src/lib/__tests__/services.test.ts`
- Test: `src/lib/payment/__tests__/payment-flow.integration.test.ts`

**Interfaces:**
- `orderService.create(data, options?: { idempotencyKey?: string })` returns an internal result `{ order: Record<string, unknown>; paymentConfirmationToken: string; replayed: boolean }`.
- Existing callers that omit `options` remain supported.
- `fingerprintCreateOrderInput` and `encryptPaymentToken` are consumed from `@/lib/order-idempotency`.

- [ ] **Step 1: Update service tests to assert the internal result and failure isolation.**

Add tests that mock `orderRepository.createAtomic` and assert:

```ts
expect(result.paymentConfirmationToken).toBeDefined();
expect(result.replayed).toBe(false);
expect(result.order).toEqual(expect.objectContaining({ id: "order-1" }));
```

Also make `analyticsRepository.trackEvent` and `logOrderStatusChange` reject in separate tests and assert `orderService.create` still resolves with the committed order.

- [ ] **Step 2: Run the service tests to see the expected failures.**

Run: `npm test -- --runInBand src/lib/__tests__/services.test.ts`
Expected: failures from the changed return shape, new repository arguments, and currently propagated side-effect errors.

- [ ] **Step 3: Normalize the service input and create the fingerprint before the atomic call.**

Use the validated order fields and item list to create the fingerprint. Generate the raw token once. For keyed requests, encrypt the raw token and pass `{ key, fingerprint, encryptedPaymentToken }` to `createAtomic`; for unkeyed requests, preserve the current atomic path.

When the repository reports `replayed: true`, decrypt the stored encrypted token and return it with the reloaded order. If decryption fails, throw a generic configuration/data-integrity error without exposing token contents.

- [ ] **Step 4: Isolate post-commit logging and analytics.**

After `createAtomic` resolves, run the status log and analytics in `Promise.allSettled`. For each rejected result, call `console.error` with only the order ID and operation name. Do not include the raw token, full customer payload, database query text, or payment proof. Always return the committed order result.

- [ ] **Step 5: Run service and payment-flow tests.**

Run: `npm test -- --runInBand src/lib/__tests__/services.test.ts src/lib/payment/__tests__/payment-flow.integration.test.ts`
Expected: PASS for new/replayed order results and non-fatal side effects.

---

## Task 4: Remove URL token transport and set the scoped HttpOnly cookie

**Files:**
- Modify: `src/app/api/orders/route.ts`
- Modify: `src/app/checkout/page.tsx`
- Modify: `src/app/payment/[orderId]/page.tsx`
- Modify: `src/lib/validators/order.ts`
- Test: `src/app/api/orders/__tests__/route.test.ts`

**Interfaces:**
- The order route reads `req.headers.get("Idempotency-Key")` and passes the normalized key to `orderService.create`.
- The route uses `NextResponse.cookies.set` with cookie name `payment_confirmation_<orderId>` and path `/api/orders/<orderId>/confirm`.
- The public JSON response contains the order and `manualPayment`/replay metadata as appropriate, but never `paymentConfirmationToken`.

- [ ] **Step 1: Write route and checkout regression tests.**

Cover:

```ts
expect(response.headers.get("set-cookie")).toContain("HttpOnly");
expect(response.headers.get("set-cookie")).toContain("Path=/api/orders/order-1/confirm");
expect(await response.json()).not.toHaveProperty("data.paymentConfirmationToken");
expect(fetchMock).toHaveBeenCalledWith("/api/orders", expect.objectContaining({
  headers: expect.objectContaining({ "Idempotency-Key": expect.any(String) }),
}));
```

Add a source/behavior assertion that checkout navigation is `/payment/order-1` and not `/payment/order-1?token=...`.

- [ ] **Step 2: Run the route tests to verify they fail.**

Run: `npm test -- --runInBand src/app/api/orders/__tests__/route.test.ts`
Expected: FAIL because the route currently returns the raw token and checkout appends it to the URL.

- [ ] **Step 3: Update the order route response and cookie handling.**

Validate the optional header: absent is allowed; present must pass `validateIdempotencyKey`, otherwise return the existing validation error envelope with `400`. Call the service with the key. Destructure the internal raw token before constructing the public response. Set the cookie with `httpOnly: true`, `secure: process.env.NODE_ENV === "production"`, `sameSite: "lax"`, `path` scoped to the confirmation endpoint, and `maxAge` based on the existing payment expiry constant. Return only sanitized order data.

- [ ] **Step 4: Update checkout submission.**

Create a `useRef<string | null>` for the logical submission key. Generate it with `crypto.randomUUID()` immediately before the first submission and reuse it for retries while the checkout page remains mounted. Send it in the `Idempotency-Key` header. Navigate to `/payment/${orderId}` with no query string after success.

- [ ] **Step 5: Run the route/service tests.**

Run: `npm test -- --runInBand src/app/api/orders/__tests__/route.test.ts src/lib/__tests__/services.test.ts`
Expected: PASS and no public raw token exposure.

---

## Task 5: Make confirmation cookie-backed and reject query-string tokens

**Files:**
- Modify: `src/app/api/orders/[orderId]/confirm/route.ts`
- Modify: `src/app/payment/[orderId]/page.tsx`
- Modify: `src/lib/validators/order.ts`
- Create/modify: `src/app/api/orders/[orderId]/confirm/__tests__/route.test.ts`
- Modify: `src/lib/payment/__tests__/confirmation-token.test.ts` if compatibility coverage belongs there

**Interfaces:**
- The route resolves `cookieToken = (await cookies()).get(paymentConfirmationCookieName(orderId))?.value`.
- It chooses the cookie token first and uses `body.confirmationToken` only as temporary compatibility fallback.
- `paymentConfirmationCookieName(orderId): string` is shared by the order and confirmation routes, preferably exported from a small server-safe helper to prevent naming drift.

- [ ] **Step 1: Add failing confirmation route tests.**

Cover cookie success, body fallback, query rejection, missing token, invalid token, duplicate confirmation, and rate limiting. Assert that a token placed only in `?token=` does not reach `confirmTransfer`.

- [ ] **Step 2: Run the confirmation tests to verify the current URL-dependent behavior fails.**

Run: `npm test -- --runInBand "src/app/api/orders/[orderId]/confirm/__tests__/route.test.ts"`
Expected: FAIL until the route resolves the scoped cookie and the client stops supplying a URL token.

- [ ] **Step 3: Update the validator and route token resolution.**

Make `confirmationToken` optional at schema level with the existing length/content constraints when present. Parse buyer fields and note first, read the scoped cookie, then resolve `cookieToken ?? parsedBodyToken`. If neither exists, return the existing validation error. Do not read `request.nextUrl.searchParams.get("token")`. Preserve rate limiting, `validateTransferToken`, `confirmTransfer`, proof upload, and safe response behavior.

- [ ] **Step 4: Remove token URL parsing and form submission from the payment page.**

Delete the `URLSearchParams` token initialization, token state, and `formData.append("confirmationToken", ...)`. Keep the order ID route parameter, payment status display, upload flow, and confirmation state unchanged. The browser automatically sends the same-origin cookie with the confirmation request.

- [ ] **Step 5: Run confirmation and payment tests.**

Run: `npm test -- --runInBand "src/app/api/orders/[orderId]/confirm/__tests__/route.test.ts" src/lib/payment/__tests__/confirmation-token.test.ts`
Expected: PASS, including compatibility body-token coverage and explicit query-token rejection.

---

## Task 6: Add end-to-end and concurrency regression coverage

**Files:**
- Create: `e2e/checkout-payment.spec.ts`
- Modify: `src/lib/payment/__tests__/payment-flow.integration.test.ts`
- Modify: `playwright.config.ts` only if the existing configuration lacks the required web server/base URL behavior

- [ ] **Step 1: Write browser-level tests for the clean payment URL.**

Use the existing Playwright fixtures and mock/intercept the order API. Submit checkout, capture the `Idempotency-Key`, return a response with a `Set-Cookie` header, and assert the browser lands on `/payment/<id>` without `token` in `page.url()`.

- [ ] **Step 2: Write concurrency tests around the service/repository seam.**

Use two simultaneous calls with the same key and a deterministic repository/RPC mock that models the unique-key boundary. Assert one result is a replay, both results reference the same order, and the atomic create call occurs once. Add a different-key stock exhaustion case asserting one request fails without a second decrement.

- [ ] **Step 3: Run the focused Playwright and integration tests.**

Run:

```bash
npm run e2e -- e2e/checkout-payment.spec.ts
npm test -- --runInBand src/lib/payment/__tests__/payment-flow.integration.test.ts
```

Expected: PASS when dependencies and the configured test environment are available; otherwise report the exact environment prerequisite rather than disabling the tests.

---

## Task 7: Document migration and runtime configuration

**Files:**
- Modify: `README.md` or the project’s existing deployment documentation
- Modify: `scripts/supabase-schema.sql` only if it is the canonical schema baseline
- Modify: `.env.example` only if the repository contains one; otherwise document the variable without creating unrelated configuration

- [ ] **Step 1: Document migration order.**

State that `008_order_idempotency.sql` must be applied after the existing security/payment migrations and before deploying the application code that sends idempotency parameters. State that the old RPC overload must not remain executable after migration.

- [ ] **Step 2: Document `PAYMENT_IDEMPOTENCY_ENCRYPTION_KEY`.**

Document that production requires a base64-encoded 32-byte secret, that it must be stored in the deployment secret manager, and that it must not be exposed to the browser or committed to source. Explain that rotating it requires a replay-retention plan because old encrypted tokens become unreadable.

- [ ] **Step 3: Document cookie behavior and rollback.**

Explain that payment URLs no longer carry tokens, same-origin cookies are required for the preferred confirmation path, and body-token compatibility remains temporarily. Include rollback order: deploy a compatible application first, then revert only after idempotency rows are no longer referenced; never drop the table while active keyed checkouts exist.

- [ ] **Step 4: Review the documentation for secret leakage and migration contradictions.**

Search for token names and environment variables, and verify that no example contains a real secret or raw token.

---

## Task 8: Review and release-gate validation

**Files:**
- All Phase 1 files above

- [ ] **Step 1: Run the focused unit and route suites.**

```bash
npm test -- --runInBand \
  src/lib/__tests__/order-idempotency.test.ts \
  src/lib/__tests__/services.test.ts \
  src/app/api/orders/__tests__/route.test.ts \
  "src/app/api/orders/[orderId]/confirm/__tests__/route.test.ts" \
  src/lib/payment/__tests__/confirmation-token.test.ts
```

Expected: all focused suites pass.

- [ ] **Step 2: Run project-wide static checks in parallel.**

```bash
npm run typecheck
npm run lint
npm run build
```

Expected: all commands exit successfully. If dependencies are not installed, stop and install using the repository’s declared package manager before retrying; do not claim success from missing binaries.

- [ ] **Step 3: Run the full unit and E2E release checks.**

```bash
npm run test:ci
npm run e2e
```

Expected: all configured suites pass, with no new snapshot, console, or network failures.

- [ ] **Step 4: Spawn a code reviewer for the complete diff.**

Review specifically for raw-token leakage, idempotency race windows, RPC overload retention, cookie path mismatches, accidental public exposure of encrypted token data, false checkout failures, and unrelated changes.

- [ ] **Step 5: Resolve review findings and repeat the affected checks.**

For every finding, add or update a regression test before changing implementation. Re-run the narrowest failing test, then repeat the full release gate after all findings are resolved.

- [ ] **Step 6: Inspect final status without staging unrelated files.**

Run: `git status --short --branch`

Expected: only intentional Phase 1 files and the previously identified design/plan documentation are present; do not stage or alter unrelated modifications.

---

## Self-review checklist

- [x] Every approved design goal maps to one or more concrete tasks.
- [x] Token URL removal is covered in checkout, payment page, order route, confirmation route, and E2E tests.
- [x] Optional idempotency, same-key replay, changed-payload conflict, and concurrency are covered.
- [x] Encrypted replay storage is specified without plaintext token persistence.
- [x] Post-commit logging/analytics failures are explicitly isolated and tested.
- [x] Migration ordering and old RPC overload removal are explicit.
- [x] Commands are included for focused tests, static checks, build, and E2E.
- [x] No unresolved placeholders, vague “add validation” steps, or undefined cross-task interfaces remain.
- [x] Unrelated existing working-tree changes are protected from staging or overwrite.
