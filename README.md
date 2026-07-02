# 🛒 LEIZ STORE — Dragon Nest Insane Game Materials Marketplace

Selamat datang di repository resmi **LEIZ STORE**. Proyek ini adalah platform marketplace premium berbasis web untuk memfasilitasi transaksi jual-beli material game Dragon Nest Insane (DNP, gold, pouches, coupons, dll.) secara aman, terverifikasi, dan otomatis melalui koordinasi multi-agent AI.

---

## 🛠️ Tech Stack & Arsitektur

Proyek ini dibangun di atas fondasi teknologi modern:
- **Frontend / Backend**: Next.js 16 (App Router) + React 19 + TypeScript
- **Database / Backend-as-a-Service**: Supabase (PostgreSQL, Realtime, Row-Level Security)
- **State Management**: Zustand (dengan persitensi local storage)
- **Styling**: Tailwind CSS v4 + Framer Motion (untuk animasi transisi checkout)
- **Testing**: Jest (Unit testing) + Playwright (End-to-End integration testing)
- **Orkestrasi Agen**: Arsitektur Multi-Agent berbasis model spesialis dari NVIDIA, Poolside, dan Cohere.

---

## 🤖 Panduan Konfigurasi Custom Agent (Model Overrides & Hyperparameters)

Untuk mencapai performa terbaik, konfigurasi agent mode Anda dengan spesifikasi berikut di dashboard admin/development Anda:

### 1. Central Dispatch & Orchestration
- **Orchestrator** (Model: `NVIDIA Nemotron 3 Ultra` | Temp: `0.0` | Top P: `0` | Max Steps: `35`)  
  *Menerima query user, merancang sub-task, mendelegasikan ke agen spesialis secara paralel, dan mensintesis hasil akhir.*

### 2. Core Development & Implementation
- **code** (Model: `Inception / Mercury` | Temp: `Default` | Top P: `Default` | Max Steps: `15`)  
  *Penulisan fitur dan implementasi logika bisnis Next.js & TypeScript.*
- **frontend-specialist** (Model: `Poolside Laguna XS.2` | Temp: `0.1` | Top P: `0.1` | Max Steps: `20`)  
  *Implementasi komponen UI/UX, transisi Framer Motion, layout Tailwind CSS v4.*
- **architect** (Model: `NVIDIA Nemotron 3 Ultra` | Temp: `0.1` | Top P: `0.1` | Max Steps: `15`)  
  *Mendesain arsitektur modul, skema DB, dan menghasilkan spesifikasi teknis.*

### 3. Quality Assurance & Review
- **code-reviewer** (Model: `NVIDIA Nemotron Super` | Temp: `0.0` | Top P: `0.0` | Max Steps: `15`)  
  *Melakukan peninjauan kode, pengecekan best practices, dan audit keamanan OWASP.*
- **code-simplifier** (Model: `Cohere North Mini Code` | Temp: `0.1` | Top P: `0.1` | Max Steps: `15`)  
  *Melakukan refactoring, pembersihan kode mati, dan menyederhanakan fungsi kompleks.*
- **code-skeptic** (Model: `NVIDIA Nemotron Super` | Temp: `0.3` | Top P: `0.3` | Max Steps: `15`)  
  *Berperan sebagai penguji adversarial, mencari celah keamanan, logika cacat, dan edge cases.*

### 4. Testing & Diagnostics
- **test-engineer** (Model: `Cohere North Mini Code` | Temp: `0.0` | Top P: `0.0` | Max Steps: `20`)  
  *Menulis test suite unit (Jest) dan skenario end-to-end (Playwright).*
- **debug** (Model: `Poolside Laguna XS.2` | Temp: `0.0` | Top P: `0.0` | Max Steps: `20`)  
  *Mendiagnosis crash, menganalisis stack trace, dan merekomendasikan perbaikan root-cause.*

### 5. Utilities & Data
- **explore** (Model: `Cohere North Mini Code` | Temp: `Default` | Top P: `Default` | Max Steps: `10`)  
  *Navigasi cepat dan pembacaan codebase menggunakan pattern-matching grep/glob.*
- **data** (Model: `NVIDIA Nemotron 3 Ultra` | Temp: `0.0` | Top P: `0.0` | Max Steps: `20`)  
  *Menangani eksekusi query PostgreSQL, manipulasi skema, dan analisis database.*
- **docs-specialist** (Model: `NVIDIA Nemotron Super` | Temp: `0.3` | Top P: `0.5` | Max Steps: `10`)  
  *Menulis dokumentasi markdown, panduan API, dan berkas README.*

---

## 🧠 Integrasi Claude-Mem (Persistent Context System)

Project ini didukung oleh **Claude-Mem** untuk menjaga memori jangka panjang agen lintas sesi sehingga tidak kehilangan konteks pekerjaan penting.

### Cara Instalasi & Setup

1. **Prasyarat**: Pastikan Node.js 18+ sudah terpasang.
2. **Setup Otomatis**:
   Jalankan script setup yang telah disediakan:
   ```bash
   bash scripts/setup-mem.sh
   ```
3. **Instalasi Manual**:
   ```bash
   # Install global plugin
   npx claude-mem install
   
   # Setup folder lokal di project
   mkdir -p .claude-mem/db
   
   # Jalankan background worker dengan database lokal project
   npx claude-mem start --db-path ./.claude-mem/db
   ```
4. **Verifikasi**:
   Restart terminal/client MCP Anda. Claude-Mem akan otomatis berjalan sebagai plugin di background dan melacak konteks development Anda.

---

## 🚀 Memulai Development lokal

1. Clone repository ini.
2. Install dependensi:
   ```bash
   npm install
   ```
3. Konfigurasi environment variables dengan menyalin `.env.example` ke `.env.local`.
4. Jalankan server development:
   ```bash
   npm run dev
   ```
5. Akses platform lokal di `http://localhost:3000`.

---
Dibuat oleh MACENG.
 Dragon Nest Insane DN — Premium Game Materials Marketplace
