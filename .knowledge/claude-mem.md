# 🧠 Claude-Mem Integration (Persistent Context System)

Project ini mengintegrasikan **Claude-Mem** (https://github.com/thedotmack/claude-mem) sebagai sistem memori persisten lintas sesi untuk mencegah hilangnya konteks penting selama proses debugging dan penulisan fitur kompleks.

## Arsitektur Integrasi

- **Vector Database**: Menggunakan ChromaDB lokal yang disimpan di `.claude-mem/db/` untuk menyimpan embedding aktivitas agen, keputusan arsitektur, dan riwayat bug.
- **Service Layer**: Berjalan sebagai background daemon worker yang dikelola via NPX.
- **MCP Client Bridge**: Menghubungkan context memory langsung ke Cursor, VSCode, atau OpenClaw CLI.

## Cara Memulai & Script Setup

Gunakan script setup otomatis yang disediakan di `scripts/setup-mem.sh` atau jalankan manual:

```bash
# 1. Install claude-mem secara global
npx claude-mem install

# 2. Jalankan background worker dengan database lokal project
npx claude-mem start --db-path ./.claude-mem/db
```

## Penggunaan

Setelah setup, Claude-Mem akan otomatis:
- Index semua aktivitas agen dan keputusan arsitektur
- Menyimpan embedding untuk semantic search
- Menyediakan context recall via MCP bridge

Untuk query manual:
```bash
npx claude-mem query "bug authentication"
npx claude-mem status
```
