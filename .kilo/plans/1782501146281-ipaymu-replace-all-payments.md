# Plan: Replace All Payment Methods with iPaymu

## Goal
Hapus semua method pembayaran lama (qris, dana, ovo, gopay, bank_transfer) dan ganti 100% dengan iPaymu Payment Gateway v2.

## Prerequisites
Reset working tree ke HEAD dulu (ada stale implementation):
```
git checkout -- .
git clean -fd
```

## Credentials (from user)
- `IPAYMU_VA=1179005161602919`
- `IPAYMU_API_KEY=6CB67E51-6934-4CEE-90BC-CAFFAC76707C`

## Signature Formula (from docs_payment.md)
```
StringToSign = UPPERCASE(HttpMethod) + ":" + VaNumber + ":" + SHA256(RequestBody) + ":" + ApiKey
signature    = HMAC-SHA256(StringToSign, ApiKey)
```
Headers: `va`, `timestamp` (YYYYMMDDHHmmss), `signature`

---

## Task 1: Create `src/lib/ipaymu.ts`
Client module dengan:
- `generateSignature(method, body)` — formula sesuai docs
- `getTimestamp()` — format YYYYMMDDHHmmss
- `apiRequest<T>(method, endpoint, body)` — generic request dengan header auth
- `createDirectPayment(params)` — POST `/api/v2/payment/direct` untuk VA
- `createRedirectPayment(params)` — POST `/api/v2/payment` untuk redirect
- `checkTransaction(transactionId)` — POST `/api/v2/transaction`
- `handleIPaymuCallback(body)` — parse webhook body, support field names: `InvoiceNo`|`reference_id`, `TransaksiID`|`transaction_id`|`trx_id`, `Status` (1=success), `Amount`
- `ipaymuService` — barrel object export

## Task 2: Update `src/lib/prisma-types.ts`
Replace `PaymentMethod` enum:
```ts
export const PaymentMethod = {
  IPAYMU_VA: "ipaymu_va",
  IPAYMU_REDIRECT: "ipaymu_redirect",
} as const;
```
Remove: QRIS, DANA, OVO, GOPAY, BANK_TRANSFER, IPAYMU_QRIS, IPAYMU_CSTORE

## Task 3: Update `src/lib/services/index.ts`
In `orderService.create()`:
1. Import `ipaymuService` and `PaymentStatus`
2. After order creation inside transaction, check `data.paymentMethod.startsWith("ipaymu_") && ipaymuService.isConfigured()`
3. If `ipaymu_redirect`: call `ipaymuService.createRedirectPayment()`
4. If `ipaymu_va:*`: parse channel from `paymentMethod.split(":")[1]`, call `ipaymuService.createDirectPayment({ paymentMethod: "va", paymentChannel })`
5. Create `prisma.payment` record with status `PENDING`
6. Update order to `WAITING_PAYMENT` status + `paymentRef`
7. Return order with `ipaymuPayment` object attached (transactionId, accountNumber, accountName, paymentUrl, expiredAt, fee)

## Task 4: Create `src/app/api/payments/ipaymu/callback/route.ts`
- POST handler
- Rate limit
- Parse body via `handleIPaymuCallback`
- Find order by `referenceId = InvoiceNo` (which matches `orderNumber`)
- On SUCCESS: update order → PAID, payment → VERIFIED
- On FAILED: update payment → FAILED
- Return 200 "OK"

## Task 5: Rewrite `src/app/checkout/page.tsx`
- Remove all old payment methods arrays
- Only show 2 groups:
  - **Virtual Account (iPaymu)**: `ipaymu_va:bca`, `ipaymu_va:bni`, `ipaymu_va:bri`, `ipaymu_va:mandiri`, `ipaymu_va:cimb`, `ipaymu_va:permata`
  - **Redirect Payment**: `ipaymu_redirect` (iPaymu Page)
- Add state: `ipaymuPayment` (IPaymuPaymentInfo | null)
- On `handleComplete`: extract `data.data.ipaymuPayment` from API response
- Step 4 (Confirmation): if `ipaymuPayment` exists:
  - Show VA number with copy button if `accountNumber` exists
  - Show "Pay via iPaymu" link button if `paymentUrl` exists without accountNumber
  - Show Transaction ID, expiry time, total + fee
- If no `ipaymuPayment`: show generic "confirm on Discord" message

## Task 6: Update env files
- `.env.example`: add `IPAYMU_VA` and `IPAYMU_API_KEY` placeholders
- `.env.local`: add actual credentials from user

## Task 7: Verification
1. `npx tsc --noEmit` — zero errors
2. Manual test: add items to cart, go to checkout, select BCA VA, complete order → should see VA number in confirmation step
3. Webhook test: POST to `/api/payments/ipaymu/callback` with mock body

## Data Flow
```
Checkout → POST /api/orders → orderService.create()
  → prisma.$transaction (order + items + stock)
  → ipaymu.createDirectPayment() → POST my.ipaymu.com/api/v2/payment/direct
  → prisma.payment.create({ status: PENDING })
  → return { ...order, ipaymuPayment: { accountNumber, transactionId, ... } }

iPaymu webhook → POST /api/payments/ipaymu/callback
  → order.paid + payment.verified → order diproses
```

## Risk: Webhook Field Names
iPaymu webhook field names are undocumented precisely. Handler must support both `InvoiceNo`/`reference_id` and `TransaksiID`/`transaction_id`/`trx_id`. Status field is string `"1"` for success per docs.
