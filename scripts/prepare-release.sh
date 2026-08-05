#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# LEIZ STORE — Prepare Release
#
# Skrip verifikasi PRA-RILIS. Jalankan dari branch `develop`
# (atau branch sumber lain via --from) SEBELUM membuat branch
# release/vX.Y.Z dan merge ke `main`.
#
# Usage:
#   ./scripts/prepare-release.sh 2.1.0
#   ./scripts/prepare-release.sh 2.1.0 --e2e
#   ./scripts/prepare-release.sh 2.1.0 --skip-build
#   ./scripts/prepare-release.sh 2.1.0 --from develop --no-fetch
#   ./scripts/prepare-release.sh --help
#
# Exit code 0 = lulus semua pemeriksaan, siap rilis.
# Exit code 1 = ada pemeriksaan yang gagal.
# ─────────────────────────────────────────────────────────────

set -uo pipefail

# ── Konfigurasi ─────────────────────────────────────────────
VERSION_RE='^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z.-]+)?$'
SOURCE_BRANCH="develop"
RUN_E2E=0
RUN_BUILD=1
DO_FETCH=1
VERSION=""

# ── Warna output ────────────────────────────────────────────
if [ -t 1 ]; then
  C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'; C_RED=$'\033[31m'
  C_CYAN=$'\033[36m'; C_BOLD=$'\033[1m'; C_RESET=$'\033[0m'
else
  C_GREEN=""; C_YELLOW=""; C_RED=""; C_CYAN=""; C_BOLD=""; C_RESET=""
fi

info()  { printf '%s%s%s\n'   "${C_CYAN}${C_BOLD}" "▶ $*" "${C_RESET}"; }
ok()    { printf '%s%s%s\n'   "${C_GREEN}"  "✔ $*" "${C_RESET}"; }
warn()  { printf '%s%s%s\n'   "${C_YELLOW}" "⚠ $*" "${C_RESET}"; }
fail()  { printf '%s%s%s\n'   "${C_RED}${C_BOLD}" "✘ $*" "${C_RESET}"; }

usage() {
  cat <<EOF
${C_BOLD}PREPARE RELEASE — LEIZ STORE${C_RESET}

Usage:
  $0 <version> [options]

Argumen:
  <version>       Versi rilis, format SemVer, contoh: 2.1.0 atau 2.1.0-rc.1

Options:
  --from <branch>  Branch sumber verifikasi (default: develop)
  --e2e            Juga jalankan Playwright E2E (butuh chromium: npx playwright install)
  --skip-build     Lewati 'npm run build' (mis. hanya ingin cek cepat)
  --no-fetch       Jangan jalankan git fetch ke remote
  --help           Tampilkan bantuan ini

Contoh:
  $0 2.1.0
  $0 2.1.0 --e2e --skip-build
EOF
}

# ── Parsing argumen ─────────────────────────────────────────
while [ "$#" -gt 0 ]; do
  case "$1" in
    --help|-h)            usage; exit 0 ;;
    --from)               shift; SOURCE_BRANCH="${1:-}"; [ -z "$SOURCE_BRANCH" ] && { fail "--from butuh nilai branch"; exit 1; } ;;
    --e2e)                RUN_E2E=1 ;;
    --skip-build)         RUN_BUILD=0 ;;
    --no-fetch)           DO_FETCH=0 ;;
    -*)
      fail "Opsi tidak dikenal: $1"; usage; exit 1 ;;
    *)
      [ -n "$VERSION" ] && { fail "Terlalu banyak argumen: $1"; usage; exit 1; }
      VERSION="$1" ;;
  esac
  shift
done

# ── Preflight: versi ────────────────────────────────────────
if [ -z "$VERSION" ]; then
  fail "Versi wajib diisi. Contoh: $0 2.1.0"
  usage
  exit 1
fi
if ! [[ "$VERSION" =~ $VERSION_RE ]]; then
  fail "Format versi tidak valid: '$VERSION'. Gunakan SemVer, contoh: 2.1.0 / 2.1.0-rc.1"
  exit 1
fi

# ── Preflight: git & root ───────────────────────────────────
if ! git rev-parse --git-dir >/dev/null 2>&1; then
  fail "Bukan repository git. Jalankan dari dalam repository."
  exit 1
fi

# Selalu jalankan dari root repo (npm run ... butuh package.json)
cd "$(git rev-parse --show-toplevel)" || exit 1

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$CURRENT_BRANCH" != "$SOURCE_BRANCH" ]; then
  fail "Harus berada di branch '$SOURCE_BRANCH' (sekarang: '$CURRENT_BRANCH')."
  fail "Lakukan: git checkout $SOURCE_BRANCH, lalu jalankan ulang skrip ini."
  exit 1
fi

echo ""
info "== LEIZ STORE — PREPARE RELEASE v$VERSION =="
info "Branch sumber: $SOURCE_BRANCH"
echo ""

# ── 1. Working tree bersih ──────────────────────────────────
info "1) Memeriksa working tree ..."
if [ -n "$(git status --porcelain)" ]; then
  fail "Working tree tidak bersih. Commit atau stash perubahan dulu."
  git status --short
  exit 1
fi
ok "Working tree bersih."

# ── 2. Sinkronisasi dengan remote ───────────────────────────
info "2) Memeriksa sinkronisasi dengan remote ..."
UPSTREAM="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)"
if [ -n "$UPSTREAM" ]; then
  if [ "$DO_FETCH" = "1" ]; then
    git fetch origin "$SOURCE_BRANCH" --quiet 2>/dev/null \
      || warn "git fetch gagal — cek koneksi. Melanjutkan dengan data lokal."
  fi
  AHEAD="$(git rev-list --count '@{u}..HEAD' 2>/dev/null || echo 0)"
  BEHIND="$(git rev-list --count 'HEAD..@{u}' 2>/dev/null || echo 0)"
  if [ "${AHEAD:-0}" -gt 0 ] && [ "${BEHIND:-0}" -gt 0 ]; then
    fail "Branch '$SOURCE_BRANCH' diverged dari '$UPSTREAM' (ahead ${AHEAD}, behind ${BEHIND})."
    fail "Selesaikan dulu: git pull --rebase, lalu ulangi."
    exit 1
  elif [ "${BEHIND:-0}" -gt 0 ]; then
    fail "Branch tertinggal ${BEHIND} commit dari '$UPSTREAM'. Jalankan: git pull"
    exit 1
  elif [ "${AHEAD:-0}" -gt 0 ]; then
    warn "Branch ${AHEAD} commit di depan '$UPSTREAM' (belum di-push). Pastikan ini disengaja."
  else
    ok "Branch sinkron dengan '$UPSTREAM'."
  fi
else
  warn "Tidak ada upstream untuk '$SOURCE_BRANCH' — cek sinkronisasi remote dilewati."
fi

# ── 3. Cabang/tag rilis belum ada ───────────────────────────
info "3) Memeriksa branch & tag rilis ..."
# Skip cek branch-release jika kita sedang berada DI branch rilis itu sendiri
# (pola re-run: prepare-release.sh X.Y.Z --from release/X.Y.Z)
if [ "$SOURCE_BRANCH" != "release/${VERSION}" ] \
  && git show-ref --verify --quiet "refs/heads/release/${VERSION}"; then
  warn "Branch 'release/${VERSION}' sudah ada. Gunakan versi lain atau hapus branch lama."
fi
if git rev-parse -q --verify "refs/tags/v${VERSION}" >/dev/null; then
  warn "Tag 'v${VERSION}' sudah ada. Gunakan versi lain (semver harus naik)."
fi
ok "Pemeriksaan branch/tag selesai."

# ── 4. Verifikasi otomatis ──────────────────────────────────
PASS_COUNT=0
FAIL_COUNT=0
CHECK_NUM=4

run_step() {
  local name="$1"; shift
  echo ""
  info "${CHECK_NUM}) $name"
  CHECK_NUM=$((CHECK_NUM + 1))
  if "$@"; then
    ok "$name — lulus"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    fail "$name — GAGAL"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

run_step "Lint (eslint)"       npm run lint
run_step "TypeCheck (tsc)"     npm run typecheck
run_step "Unit Test (jest + coverage)" npm run test:ci

if [ "$RUN_BUILD" = "1" ]; then
  run_step "Build produksi (next build)" npm run build
fi

if [ "$RUN_E2E" = "1" ]; then
  run_step "E2E (playwright)"  npm run e2e
fi

# test:ci menulis ulang junit.xml (file terlacak di repo) — pulihkan agar
# working tree tetap bersih setelah verifikasi dan skrip bisa dijalankan ulang.
git checkout -- junit.xml 2>/dev/null || true

# ── 5. Ringkasan ────────────────────────────────────────────
echo ""
if [ "$FAIL_COUNT" -gt 0 ]; then
  fail "PREPARE RELEASE GAGAL — ${FAIL_COUNT} tahap tidak lulus (${PASS_COUNT} lulus)."
  fail "Perbaiki masalah di atas sebelum membuat branch rilis."
  exit 1
fi

ok "SEMUA VERIFIKASI LULUS (${PASS_COUNT} tahap)."
echo ""
echo "======================================================================"
echo "  LANJUTKAN RILIS v${VERSION}:"
echo "======================================================================"
echo ""
echo "  # 1. Buat branch rilis dari $SOURCE_BRANCH"
echo "  git checkout -b release/${VERSION} $SOURCE_BRANCH"
echo ""
echo "  # 2. Bump versi di package.json + package-lock.json (tanpa tag otomatis)"
echo "  npm version ${VERSION} --no-git-tag-version"
echo ""
echo "  # 3. Commit bump versi (hanya bugfix yang boleh masuk setelah ini)"
echo "  git add package.json package-lock.json"
echo "  git commit -m \"chore(release): bump version to ${VERSION}\""
echo ""
echo "  # 4. Verifikasi sekali lagi di branch rilis"
echo "  ./scripts/prepare-release.sh ${VERSION} --from release/${VERSION} --skip-build"
echo ""
echo "  # 5. Push branch rilis, buka PR release/${VERSION} -> main (wajib review)"
echo "  git push -u origin release/${VERSION}"
echo ""
echo "  # 6. Setelah PR di-merge ke main: beri tag di main"
echo "  git checkout main && git pull"
echo "  git tag -a v${VERSION} -m \"Release ${VERSION}\""
echo "  git push origin v${VERSION}"
echo ""
echo "  # 7. Merge balik ke develop agar develop tidak tertinggal"
echo "  git checkout develop && git pull"
echo "  git merge --no-ff main -m \"chore(release): merge v${VERSION} back to develop\""
echo "  git push"
echo ""
echo "  Panduan lengkap: docs/release-process.md"
echo "======================================================================"
