# 🐛 Bug History & Security Audit (Juni/Juli 2026)

Riwayat bug kritis yang diidentifikasi dan diperbaiki dalam audit keamanan.

## Status Bug

| ID | Issue | Status | Fix Location |
|----|-------|--------|--------------|
| **BUG-01** | Hardcoded Credentials | ✅ Fixed | `src/app/api/admin/login/route.ts` |
| **BUG-02** | Plain-text Password Match | ✅ Fixed | Password hashing dengan `bcryptjs` |
| **BUG-03** | Token JWT Authentication | ✅ Fixed | `src/lib/admin-auth.ts` — native JWT validation |
| **BUG-04** | Double-Confirmation Race Condition | ✅ Fixed | `UNIQUE(order_id)` constraint + catch block di `payment-service.ts` |
| **BUG-05** | Payment Proof Base64 Loss | ✅ Fixed | `payment_proof` column di tabel `payment_confirmation` |

## Detail Perbaikan

### BUG-01: Hardcoded Credentials
- **Masalah**: Fallback admin password hardcoded di source code
- **Fix**: Hapus fallback, wajib menggunakan `ADMIN_PASSWORD` dari environment variable
- **Impact**: High — credential exposure

### BUG-02: Plain-text Password Match
- **Masalah**: Password dicocokkan secara plain-text, rentan timing attack
- **Fix**: Gunakan `bcryptjs` untuk hashing dan comparison
- **Impact**: Critical — authentication bypass

### BUG-03: Token JWT Authentication
- **Masalah**: `requireAdmin()` tidak memvalidasi JWT token dengan benar
- **Fix**: Implementasi native JWT validation menggunakan `jsonwebtoken`
- **Impact**: High — unauthorized access

### BUG-04: Double-Confirmation Race Condition
- **Masalah**: Admin bisa klik button konfirmasi 2x dalam hitungan milidetik, menyebabkan duplicate payment
- **Fix**: 
  - Tambah `UNIQUE(order_id)` constraint di tabel `payment_confirmation`
  - Wrap insert di try-catch untuk handle duplicate error
- **Impact**: Medium — duplicate transactions

### BUG-05: Payment Proof Base64 Loss
- **Masalah**: Bukti transfer (base64 image) hilang saat dikirim ke Discord
- **Fix**: Simpan base64 langsung ke kolom `payment_proof` di `payment_confirmation`, lalu attach sebagai file saat kirim notifikasi
- **Impact**: Medium — lost evidence for verification

## Lessons Learned

1. **Never hardcode secrets** — selalu gunakan environment variables
2. **Always hash passwords** — gunakan bcrypt/argon2, jangan plain-text
3. **Validate JWT properly** — gunakan library native, jangan custom implementation
4. **Handle race conditions** — database constraints + application-level error handling
5. **Test edge cases** — double-click, network failures, concurrent requests
