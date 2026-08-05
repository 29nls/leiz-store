# 🚀 Alur Rilis — LEIZ STORE

Dokumen ini menjelaskan **bagaimana kode berpindah dari `develop` ke `main` (production)** secara aman, terdokumentasi, dan bisa di-rollback. Semua aturan commit (`feat:` / `fix:` / `refactor:` / `docs:` / `test:`) dan struktur branch (`main` → `develop` → `feature/*`) mengikuti konvensi yang sudah disepakati di repository ini.

---

## 1. Prinsip

| Prinsip | Aturan |
|---|---|
| **Semantic Versioning (SemVer)** | `MAJOR.MINOR.PATCH` — lihat tabel di bawah |
| **`main` selalu produksi-ready** | Tidak pernah ada commit langsung ke `main`, kecuali merge rilis & hotfix |
| **`develop` adalah integrasi** | Semua fitur di-merge ke `develop` via PR yang direview |
| **Rilis lewat `release/vX.Y.Z`** | Branch rilis = "feature freeze" + final verification |
| **Tidak pernah `git push --force`** | Kecuali recovery darurat yang disepakati seluruh tim |
| **Setiap rilis punya tag** | `vX.Y.Z` di `main` → traceability + rollback point |

### Penentuan versi (SemVer)

| Jenis perubahan | Contoh pesan commit | Bump |
|---|---|---|
| Breaking change / fitur besar | `feat: ...` | **MAJOR** (2.0.0 → 3.0.0) |
| Fitur baru (backward-compatible) | `feat: ...` | **MINOR** (2.0.0 → 2.1.0) |
| Bugfix / perbaikan kecil | `fix: ...` | **PATCH** (2.0.0 → 2.0.1) |
| Hotfix produksi | `fix: ...` | **PATCH** (2.0.0 → 2.0.1) |
| Pre-release | `feat: ...` | `2.1.0-rc.1` |

> Sebelum rilis pertama dengan alur ini, pastikan versi di `package.json` lebih tinggi dari versi terakhir yang pernah dirilis.

---

## 2. Struktur Branch

```
main (production — hanya release & hotfix merge)
 │
 └── develop (integrasi fitur)
      ├── feat/order-tracking
      ├── feat/docker-deployment-hardening
      └── ...
```

### Ringkasan alur rilis normal

```
develop ──► release/v2.1.0 ──► (PR, review, final check) ──► main ──► tag v2.1.0
   ▲                                                              │
   └────────────────── merge back (v2.1.0 → develop) ◄────────────┘
```

---

## 3. Alur Rilis Normal (release/vX.Y.Z)

### Langkah 0 — Prasyarat

- Semua PR fitur sudah **di-merge ke `develop`** dan tidak ada pekerjaan yang "setengah jadi".
- Kamu punya akses untuk membuat branch, PR, dan tag.

> **Catatan CI:** workflow `.github/workflows/ci.yml` saat ini hanya terpicu untuk `main`/`master` (push & PR). Artinya PR ke `develop` **tidak** memicu CI otomatis — verifikasi `develop` dilakukan lewat `scripts/prepare-release.sh` di Langkah 1. Jika ingin CI juga memvalidasi PR ke `develop`, tambahkan `develop` ke daftar branch trigger `pull_request` di `ci.yml`.

### Langkah 1 — Verifikasi `develop` (otomatis)

Jalankan skrip verifikasi dari root repo:

```bash
git checkout develop
git pull
./scripts/prepare-release.sh 2.1.0
```

Skrip ini memeriksa secara berurutan:

1. Working tree bersih
2. `develop` sinkron dengan remote (tidak tertinggal / diverged)
3. Branch `release/2.1.0` dan tag `v2.1.0` belum ada
4. `npm run lint` (ESLint)
5. `npm run typecheck` (TypeScript)
6. `npm run test:ci` (Jest unit test + coverage)
7. `npm run build` (Next.js production build)

Opsional — tambahkan E2E Playwright:

```bash
npx playwright install chromium
./scripts/prepare-release.sh 2.1.0 --e2e
```

> **Jika ada yang gagal: berhenti.** Perbaiki di `develop`, merge fix-nya, lalu ulangi. Jangan membawa `develop` yang merah ke branch rilis.

### Langkah 2 — Buat branch rilis

```bash
git checkout -b release/2.1.0 develop
```

Mulai dari sini berlaku **feature freeze**: hanya bugfix & perbaikan dokumentasi yang boleh masuk ke branch ini. Fitur baru tetap menunggu di `develop`.

### Langkah 3 — Bump versi

```bash
npm version 2.1.0 --no-git-tag-version
git add package.json package-lock.json
git commit -m "chore(release): bump version to 2.1.0"
```

### Langkah 4 — Verifikasi final di branch rilis

```bash
./scripts/prepare-release.sh 2.1.0 --from release/2.1.0
```

> `--from release/2.1.0` memungkinkan skrip dijalankan di branch rilis (bukan `develop`).

### Langkah 5 — Push + PR ke `main` (wajib review)

```bash
git push -u origin release/2.1.0
```

Buka **Pull Request `release/2.1.0` → `main`** di GitHub dengan:

- Judul: `release: v2.1.0`
- Deskripsi: daftar perubahan (dari git log `develop..release/2.1.0` atau changelog), catatan migration/deployment, dan hasil verifikasi.
- Reviewer: minimal **1 reviewer** (sebaiknya 2 untuk rilis besar).

**Merge strategy:** gunakan **merge commit** (bukan squash/rebase) untuk rilis agar jejak `release/` tercatat di history `main`. Untuk PR fitur biasa ke `develop`, squash & merge boleh dipakai.

### Langkah 6 — Tag rilis di `main`

Setelah PR di-merge:

```bash
git checkout main
git pull
git tag -a v2.1.0 -m "Release 2.1.0"
git push origin v2.1.0
```

### Langkah 7 — Merge balik ke `develop`

Agar `develop` tidak tertinggal (misal ada bugfix yang masuk langsung ke branch rilis):

```bash
git checkout develop
git pull
git merge --no-ff main -m "chore(release): merge v2.1.0 back to develop"
git push
```

> Jika konflik muncul saat merge balik, selesaikan dengan hati-hati — jangan pernah `--force` tanpa persetujuan.

### Langkah 8 — Deployment

| Infrastruktur | Cara deploy | Trigger |
|---|---|---|
| **Vercel** | Production deployment otomatis | push/merge ke `main` (via git integration) |
| **Docker self-hosted** | `docker compose --profile proxy up -d` | manual / CD (lihat `.github/workflows/ci.yml`, job `docker-push` yang masih di-comment) |

Verifikasi pasca-deploy:

- [ ] `GET /api/health` → `200`
- [ ] Halaman utama & `/products` termuat normal
- [ ] Alur checkout + upload bukti bayar berfungsi
- [ ] Discord bot menerima interaksi (test `payment_accept_*`)
- [ ] Tidak ada error baru di log / monitoring

---

## 4. Checklist Pra-Merge ke `main`

Checklist ini wajib lulus **sebelum** PR rilis di-merge ke `main`. Salin ke deskripsi PR rilis dan centang satu per satu.

### ✅ Otomatis (CI & skrip)

- [ ] CI pipeline hijau untuk merge ke `main`: lint, typecheck, unit test, build (`.github/workflows/ci.yml`; job `e2e-tests` hanya berjalan saat push ke `main`)
- [ ] `./scripts/prepare-release.sh <version>` lulus tanpa error (exit code 0)
- [ ] CodeQL / MSDO / njsscan tidak menemukan isu baru yang blokir

### ✅ Git & Konten

- [ ] Branch rilis dibuat dari `develop` yang sudah sinkron
- [ ] Versi di `package.json` = versi rilis (sudah di-bump & di-commit)
- [ ] Tidak ada commit `WIP` / `fixup` / `test:` yang bocor ke rilis
- [ ] Semua pesan commit mengikuti format konvensional
- [ ] Changelog / deskripsi PR mencantumkan semua perubahan penting

### ✅ Migration & Secret (khusus rilis yang menyentuh DB/infra)

- [ ] Migration SQL baru (bila ada) sudah diuji di project staging Supabase
- [ ] Migration bersifat idempotent atau berurutan benar (lihat `README` → Order Payment Integrity)
- [ ] Secret baru sudah diset di secret manager deployment (bukan di repo)
- [ ] `NEXT_PUBLIC_*` build-args Docker sudah diset di repo variables (bila pakai Docker)

### ✅ Manual (smoke test di production setelah deploy)

- [ ] `/api/health` OK
- [ ] Halaman utama, katalog, detail produk OK
- [ ] Checkout → pembayaran → konfirmasi OK
- [ ] Admin panel login & CRUD OK
- [ ] Invoice email/PDF OK (bila menyentuh sistem invoice)

---

## 5. Alur Hotfix (hotfix/vX.Y.Z)

Untuk bug **kritis di produksi** yang tidak bisa menunggu rilis berikutnya.

```
main (produksi bermasalah)
 │
 └── hotfix/2.0.1  ──► (fix) ──► PR ke main (review) ──► merge + tag v2.0.1
                                   │
                                   └── merge back ke develop
```

```bash
# 1. Cut dari main (bukan develop!)
git checkout -b hotfix/2.0.1 main

# 2. Perbaiki bug, commit dengan pesan konvensional
git add .
git commit -m "fix: resolve critical checkout crash"

# 3. Push + PR ke main (review sesegera mungkin)
git push -u origin hotfix/2.0.1

# 4. Setelah merge ke main: tag
git checkout main && git pull
git tag -a v2.0.1 -m "Hotfix 2.0.1"
git push origin v2.0.1

# 5. Merge balik ke develop
git checkout develop && git pull
git merge --no-ff main -m "chore(release): merge hotfix v2.0.1 back to develop"
git push
```

> Mengapa cut dari `main`? Supaya hotfix hanya berisi perbaikan itu, tanpa fitur yang belum rilis dari `develop`.

---

## 6. Rollback

Jika rilis bermasalah di produksi:

1. **Cepat & aman:** gunakan deployment sebelumnya.
   - Vercel: buka deployment history → *Promote* / rollback ke commit `vX.Y.Z-1`.
   - Docker: ganti `IMAGE_TAG` ke tag/image sebelumnya, `docker compose up -d`.
2. **Jangka panjang:** buat hotfix, jangan revert history di `main` (commit `Revert` boleh untuk fix cepat, tapi buka issue untuk perbaikannya).
3. **Jangan pernah** `git reset --hard` / force-push ke `main` untuk "menghapus" rilis — hapus hanya tag jika belum dipakai orang lain, lalu buat tag baru.

---

## 7. FAQ

**Q: CI merah di PR rilis, bagaimana?**
Jangan merge. Perbaiki di branch rilis (jika bugfix murni) atau bawa perubahan balik ke `develop` dulu, lalu cherry-pick setelah hijau. Pastikan perbaikan juga masuk ke `develop` (langkah 7).

**Q: Konflik saat merge balik ke `develop`?**
Wajar jika `develop` sudah maju. Selesaikan konflik, commit hasil merge, push. Tidak perlu force-push.

**Q: Kapan pakai `release/` dan kapan langsung merge `develop` ke `main`?**
Selalu lewat `release/vX.Y.Z` untuk rilis resmi. Jalur langsung hanya untuk proyek single-developer yang sangat kecil — di repo ini tetap disarankan pakai branch rilis.

**Q: Versi pre-release (`2.1.0-rc.1`)?**
`prepare-release.sh` menerima format `-rc.x` / `-beta.x`. Tag pre-release sebaiknya `v2.1.0-rc.1` dan tidak otomatis di-deploy ke production.

---

## 8. Referensi

- Skrip verifikasi: [`scripts/prepare-release.sh`](../scripts/prepare-release.sh)
- CI pipeline: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)
- Panduan alur git (struktur branch & commit): [`git-workflow.md`](git-workflow.md)
- SemVer: [semver.org](https://semver.org)
