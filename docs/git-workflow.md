# 📐 Alur Git & Konvensi — LEIZ STORE

Dokumen ini adalah **sumber kebenaran** untuk cara tim bekerja dengan Git di repository ini: struktur branch, format commit, aturan review PR, dan checklist sebelum merge. Seluruh aturan di sini **wajib** diikuti oleh semua kontributor.

> Untuk alur rilis (release/vX.Y.Z, hotfix, tagging, rollback), lihat **[release-process.md](release-process.md)**.

---

## 1. Tujuan

- `main` **selalu dalam kondisi siap produksi**.
- Semua pekerjaan melalui **review** sebelum masuk ke branch penting.
- History commit **mudah dibaca & ditelusuri** (format konvensional).
- Setiap perubahan bisa **di-rollback** dengan jelas (branch + tag + PR).

---

## 2. Struktur Branch

```
main  (production — hanya menerima merge rilis & hotfix)
 │
 └── develop  (integrasi — semua fitur berkumpul di sini)
      ├── feat/<fitur>
      ├── fix/<perbaikan>
      ├── refactor/<deskripsi>
      ├── release/vX.Y.Z   (di-cut dari develop, di-merge ke main)
      └── hotfix/vX.Y.Z    (di-cut dari main untuk bug kritis produksi)
```

| Branch | Basis | Target merge | Siapa yang boleh | Umur |
|---|---|---|---|---|
| `main` | — | — | hanya via PR rilis/hotfix | permanen, jangan commit langsung |
| `develop` | `main` | — | hanya via PR fitur | permanen, jangan commit langsung |
| `feat/<nama>` | `develop` | `develop` | siapa saja | sementara, dihapus setelah merge |
| `fix/<nama>` | `develop` | `develop` | siapa saja | sementara |
| `refactor/<nama>` | `develop` | `develop` | siapa saja | sementara |
| `release/vX.Y.Z` | `develop` | `main` | maintainer / release manager | sementara |
| `hotfix/vX.Y.Z` | `main` | `main` **dan** `develop` | maintainer (darurat) | sementara |

### Aturan penamaan branch

- Huruf kecil, pisahkan kata dengan `-` (bukan `_` atau camelCase).
- Contoh: `feat/cart-persistence`, `fix/payment-timeout`, `refactor/checkout-steps`.
- Jangan sertakan nomor ticket sembarangan di nama branch kecuali sudah konvensi tim (mis. `feat/ABC-123-...`).

---

## 3. Alur Kerja Harian

### 3.1 Mulai fitur baru

```bash
# 1. Pastikan develop selalu terbaru
git checkout develop
git pull

# 2. Buat branch fitur dari develop
git checkout -b feat/cart-persistence develop
```

### 3.2 Commit dengan pesan konvensional

```bash
git add <file-file yang relevan>
git commit -m "feat: persist cart ke localStorage"

# Commit besar → pisah per unit kerja logis, jangan satu commit raksasa.
# Jangan pernah `git add -A` membabi buta; stage hanya file yang relevan.
```

### 3.3 Push & buka PR

```bash
git push -u origin feat/cart-persistence
```

Buka PR di GitHub: **base `develop`** ← compare `feat/cart-persistence`, isi deskripsi sesuai template, minta review minimal 1 orang.

### 3.4 Setelah review & merge

```bash
git checkout develop
git pull
git branch -d feat/cart-persistence   # hapus branch lokal yang sudah di-merge
git push origin --delete feat/cart-persistence   # hapus branch remote (oleh maintainer)
```

---

## 4. Format Commit Konvensional

```
<type>(<scope>): <deskripsi singkat>
```

`<scope>` **opsional** — konteks area yang diubah (mis. `security`, `invoice`, `deps`, `supabase`).

### Tipe yang dipakai di repo ini

| Type | Kegunaan | Contoh |
|---|---|---|
| `feat` | Fitur baru | `feat: implement order tracking` |
| `fix` | Perbaikan bug | `fix(security): require Discord admin role` |
| `refactor` | Ubah struktur tanpa mengubah perilaku | `refactor: simplify checkout validation` |
| `docs` | Perubahan dokumentasi | `docs: add release process guide` |
| `test` | Menambah/mengubah test | `test: cover payment idempotency` |
| `chore` | Tugas non-fungsional | `chore: update Node version in CI` |
| `chore(deps)` | Bump dependensi (umumnya oleh Dependabot) | `chore(deps): bump next from 15 to 16` |
| `ci` | Perubahan pipeline CI/CD | `ci: add docker build validation` |
| `style` | Format/kosmetik, tidak mengubah logika | `style(payment): align button spacing` |
| `perf` | Optimasi performa | `perf: lazy-load admin chart` |
| `build` | Perubahan build system | `build: enable standalone output` |
| `revert` | Mengembalikan perubahan dari commit sebelumnya | `revert: rollback payment webhook change` |

> Daftar tipe di atas harus sinkron dengan `type-enum` di `commitlint.config.mjs` — keduanya divalidasi otomatis oleh commitlint.

### Aturan penulisan

1. **Subject** (baris pertama):
   - Imperatif, aktif: *"add X"*, *"fix Y"* — bukan *"added X"* / *"fixing Y"*.
   - **Maksimal 100 karakter** (ideal ≤ 50), tanpa titik di akhir.
   - Mulai huruf kecil, kecuali nama properti (mis. `feat: add README`).
2. **Body** (opsional, setelah baris kosong): jelaskan **mengapa**, bukan apa — terutama untuk perubahan yang tidak obvious. Tulis dalam **Bahasa Indonesia** kecuali istilah teknis.
3. **Footer** (opsional): `Closes #12`, `BREAKING CHANGE: ...`.
4. **Dilarang**: pesan `WIP`, `update`, `fix stuff`, `asdf`, `merging` sebagai subject.

### Contoh lengkap

```
feat(invoice): kirim PDF invoice via email Brevo

- Generate PDF A4 (pdfkit) dengan IDR/USD, diskon, dan pajak
- Kirim via nodemailer + SMTP Brevo, lampirkan PDF
- Simpan status pengiriman di tabel job_queue untuk retry

Closes #45
```

---

## 5. Aturan Review PR

### 5.1 Aturan umum

- **Minimal 1 reviewer** untuk PR fitur/bugfix biasa; **2 reviewer** untuk rilis & perubahan infra/DB/keamanan.
- **Jangan merge PR sendiri** tanpa review orang lain (pengecualian: hotfix produksi kritis, harus dicatat & segera diinformasikan).
- PR hanya di-merge jika **CI hijau** dan **semua thread review selesai** (resolve comment).
- **Jangan pernah `git push --force`** ke branch bersama. Rebase/force hanya boleh di branch pribadi yang belum di-push.
- Untuk mengubah kode orang lain: jangan edit langsung di branch mereka — beri comment atau buka PR lanjutan.

### 5.2 Tugas reviewer (minimal)

- [ ] Kode benar-benar menyelesaikan tujuan PR (bukan sekadar "lulus CI").
- [ ] Tidak ada bug yang jelas: edge case, error handling, race condition, null safety.
- [ ] Keamanan: tidak ada secret baru, input divalidasi, tidak ada logging data sensitif.
- [ ] Mematuhi konvensi proyek (lihat struktur kode di sekitarnya, jangan re-invent).
- [ ] Test ada & bermakna untuk perubahan yang punya logika.
- [ ] Tidak ada scope creep (perubahan di luar tujuan PR).
- [ ] Perubahan UI memenuhi aksesibilitas dasar (label, keyboard, kontras).

### 5.3 Strategi merge

| PR | Strategi | Alasan |
|---|---|---|
| `feat/*` → `develop` | **Squash & merge** | History develop rapi: 1 fitur = 1 commit |
| `fix/*` → `develop` | **Squash & merge** | Sama |
| `release/*` → `main` | **Merge commit** | Jejak branch rilis terekam di history main |
| `hotfix/*` → `main` | **Merge commit** | Traceability + mudah di-rollback |
| merge balik `main` → `develop` | **Merge commit** (`--no-ff`) | Menjaga sinkronisasi |

> Catatan: squash & merge hanya untuk ke `develop`. Jangan squash PR ke `main`.

---

## 6. Checklist Sebelum Merge

### ✅ Checklist author (sebelum minta review)

- [ ] Branch di-cut dari branch yang benar (`develop` untuk fitur, `main` untuk hotfix).
- [ ] Hanya perubahan yang relevan (tidak ada file tidak sengaja ikut ter-stage).
- [ ] Pesan commit memenuhi format konvensional (bagian 4).
- [ ] `npm run lint` dan `npm run typecheck` lulus.
- [ ] `npm run test` lulus (unit test); tambah test baru bila ada logika baru.
- [ ] Tidak ada `console.log` / debug code yang tertinggal.
- [ ] Tidak ada secret / credential di kode atau file yang di-commit.
- [ ] Deskripsi PR: apa yang diubah, mengapa, dan cara testing-nya.

### ✅ Checklist reviewer (sebelum approve)

- [ ] Bagian 5.2 (tugas reviewer) sudah dicek.
- [ ] Perubahan tidak merusak alur yang ada (cek test yang terkait).
- [ ] Migration DB (bila ada) aman & berurutan benar.
- [ ] Tidak memperkenalkan dependensi yang tidak perlu.

### ✅ Checklist sebelum merge

- [ ] CI hijau (ingat: workflow CI saat ini hanya terpicu untuk `main`/`master` — untuk PR ke `develop`, verifikasi lokal via `scripts/prepare-release.sh`).
- [ ] Minimal 1 review approve (2 untuk rilis).
- [ ] Semua comment sudah di-resolve atau dijawab.
- [ ] Branch source sudah di-update dari target (tidak stale) — atau konflik sudah diselesaikan.

---

## 7. Alur Rilis & Hotfix

Ringkas:

1. **Rilis normal:** `develop` → verifikasi → `release/vX.Y.Z` → PR + review → merge ke `main` → tag `vX.Y.Z` → merge balik ke `develop`.
2. **Hotfix:** `main` → `hotfix/vX.Y.Z` → PR ke `main` → tag → merge balik ke `develop`.

Panduan lengkap, skrip verifikasi (`scripts/prepare-release.sh`), dan checklist pra-merge ke `main` ada di **[release-process.md](release-process.md)**.

---

## 8. FAQ

**Q: Lupa pesan commit konvensional?**
Ubah sebelum push: `git commit --amend -m "feat: ..."`. Jika sudah ter-push, buat commit baru `fixup:` dan squash — jangan force-push branch bersama.

**Q: Konflik merge di PR saya?**
```bash
git checkout feat/cart-persistence
git fetch origin develop
git rebase origin/develop    # atau: git merge origin/develop
# selesaikan konflik, lalu
git push --force-with-lease  # HANYA di branch pribadi milik sendiri
```

**Q: Kapan bump versi `package.json`?**
Saat rilis (di branch `release/vX.Y.Z`), bukan di setiap PR fitur. Detail: release-process.md.

**Q: Apakah boleh commit langsung ke `develop`?**
Tidak. Semua perubahan lewat branch + PR + review. Exception: perbaikan dokumentasi sepele dapat di-PR-kan langsung tanpa branch jika disetujui maintainer.

**Q: Siapa yang menghapus branch setelah merge?**
Siapa saja yang melihatnya sudah di-merge — lokal: `git branch -d <nama>`; remote: `git push origin --delete <nama>` (boleh langsung di GitHub via tombol "Delete branch").

---

## 9. Referensi

- Alur rilis: [`release-process.md`](release-process.md)
- Skrip verifikasi rilis: [`scripts/prepare-release.sh`](../scripts/prepare-release.sh)
- CI pipeline: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)
- Konvensi commit resmi: [Conventional Commits](https://www.conventionalcommits.org)
- Git branching model: [A successful Git branching model](https://nvie.com/posts/a-successful-git-branching-model/)
