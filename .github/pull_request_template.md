<!--
Terima kasih sudah berkontribusi! Isi template ini dengan lengkap.
Aturan lengkap: [../docs/git-workflow.md](../docs/git-workflow.md)
-->

## Deskripsi

<!-- Jelaskan secara singkat apa yang diubah dan MENGAPA (masalah yang diselesaikan). -->

-

## Jenis Perubahan

<!-- Centang yang sesuai (ubah [ ] menjadi [x]). -->

- [ ] 🆕 `feat` — Fitur baru
- [ ] 🐛 `fix` — Perbaikan bug
- [ ] ♻️ `refactor` — Refactor tanpa mengubah perilaku
- [ ] 📝 `docs` — Dokumentasi
- [ ] 🧪 `test` — Test
- [ ] 🔧 `chore` / `ci` — Tugas non-fungsional / pipeline

## Checklist Author (wajib sebelum minta review)

- [ ] Branch di-cut dari branch yang benar (`develop` untuk fitur, `main` untuk hotfix)
- [ ] Hanya perubahan yang relevan (tidak ada file tidak sengaja ikut ter-stage)
- [ ] Pesan commit mengikuti format konvensional (`<type>(<scope>): <subject>`)
- [ ] `npm run lint` lulus
- [ ] `npm run typecheck` lulus
- [ ] `npm run test` lulus; ada test baru untuk logika baru
- [ ] Tidak ada `console.log` / debug code yang tertinggal
- [ ] Tidak ada secret / credential di kode atau file yang di-commit

## Checklist Reviewer

- [ ] Kode benar-benar menyelesaikan tujuan PR
- [ ] Tidak ada bug yang jelas (edge case, error handling, null safety)
- [ ] Keamanan: input divalidasi, tidak ada logging data sensitif
- [ ] Mengikuti konvensi proyek yang ada (bukan re-invent)
- [ ] Tidak ada scope creep (perubahan di luar tujuan PR)
- [ ] Migration DB (bila ada) aman & berurutan benar

## Cara Testing

<!-- Langkah untuk mereproduksi / memverifikasi perubahan ini. -->

1.
2.
3.

## Screenshot (jika mengubah UI)

<!-- Tempel screenshot sebelum/sesudah bila relevan. -->

## Catatan Tambahan

<!-- Hal lain yang perlu diketahui reviewer / maintainer. -->
