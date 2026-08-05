# 🛡️ Branch Protection — LEIZ STORE

Panduan pengaturan **GitHub branch protection** untuk `main` dan `develop` agar aturan git-flow (lihat [git-workflow.md](git-workflow.md)) benar-benar dijalankan oleh platform, bukan hanya disiplin individu.

---

## 1. Ringkasan Pengaturan yang Disarankan

| Pengaturan | `main` | `develop` | Alasan |
|---|---|---|---|
| Require PR before merging | ✅ | ✅ | Tidak ada commit langsung |
| Require 1 approval | ✅ | ✅ | Review wajib |
| Require 2 approvals | rilis besar / opsional | opsional | Untuk perubahan sensitif |
| Dismiss stale reviews | ✅ | ✅ | Review kadaluarsa jika branch berubah |
| Require conversation resolution | ✅ | ✅ | Semua thread harus beres |
| Require status checks | ✅ | ✅ | CI + commitlint wajib hijau |
| Require branches up to date | ✅ | ✅ | Hindari merge stale |
| Require signed commits | opsional | opsional | Audit trail lebih kuat |
| Allow force pushes | ❌ | ❌ | Larang `--force` |
| Allow deletions | ❌ | ❌ | Jangan hapus branch utama |
| Lock branch (temporary) | saat freeze rilis | opsional | Feature freeze |

---

## 2. Cara Mengaktifkan

1. Buka repo di GitHub → **Settings** → **Branches** → **Add branch protection rule** (atau **Edit** pada rule yang ada).
2. Buat **dua rule terpisah**, satu untuk pola `main`, satu untuk pola `develop`.
3. Centang pengaturan sesuai tabel di atas.
4. Pada bagian **Require status checks to pass**, pilih:
   - `CI/CD Pipeline` (workflow `ci.yml` — lint, typecheck, unit test, build)
   - `Validate commit messages` (workflow `conventional-commits.yml` — jika sudah diaktifkan)
5. Simpan.

> **Catatan:** workflow CI (`ci.yml`) saat ini hanya terpicu untuk `main`/`master`. Agar status check `CI/CD Pipeline` muncul untuk PR ke `develop`, tambahkan `develop` ke daftar branch pada trigger `push` / `pull_request` di `.github/workflows/ci.yml`.

---

## 3. Komponen Pendukung

### 3.1 Validasi pesan commit (dua lapis)

| Lapisan | Lokasi | Kapan berjalan | Status |
|---|---|---|---|
| Lokal (developer) | `.husky/commit-msg` + `commitlint.config.mjs` | setiap `git commit` | ✅ sudah aktif |
| Server (CI) | `.github/workflows/conventional-commits.yml` | setiap PR | 🟡 draft — aktif saat di-push |

Workflow `conventional-commits.yml` menjalankan `commitlint` terhadap **semua commit di PR**. Setelah aktif, tambahkan job-nya sebagai **required status check** pada kedua rule branch protection.

### 3.2 CODEOWNERS (review otomatis)

File `.github/CODEOWNERS` (draft) memungkinkan GitHub **otomatis mewajibkan review** dari pemilik file tertentu.

1. Isi username/team yang benar di `.github/CODEOWNERS` (hapus tanda `#`).
2. Di pengaturan branch protection: aktifkan **Require review from Code Owners**.
3. Contoh aturan yang disarankan:
   - `/src/lib/payment/`, `/src/lib/auth.ts`, `/scripts/migrations/` → reviewer keamanan
   - `/src/app/api/` → reviewer backend
   - `*` → fallback seluruh repo

Dokumentasi: [About code owners](https://docs.github.com/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)

---

## 4. Alur yang Dihasilkan Setelah Diterapkan

```
developer
   │  git commit ──(husky + commitlint)──▶ wajib format konvensional
   ▼
feature branch ── push ──▶ open PR
   ▼
CI: lint, typecheck, test, build, commitlint   (semua hijau?)
   ▼
review: minimal 1 approval (+ Code Owners bila sensitif)
   ▼
merge ke develop ──(squash)──▶   rilis via release/vX.Y.Z
   ▼
merge ke main ──(merge commit + tag)──▶ production
```

---

## 5. Checklist Verifikasi Penerapan

- [ ] Rule `main`: PR wajib, 1+ approval, status checks hijau, tanpa force-push.
- [ ] Rule `develop`: PR wajib, 1+ approval, status checks hijau (setelah CI di-trigger untuk develop).
- [ ] `conventional-commits.yml` aktif dan menjadi required status check.
- [ ] `CODEOWNERS` terisi dengan username nyata, tanpa baris `#` yang menyesatkan.
- [ ] Anggota tim tahu aturan (lihat `git-workflow.md`).
