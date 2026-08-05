# syntax=docker/dockerfile:1
# LEIZ STORE - Production Dockerfile
# Multi-stage build untuk deployment Docker yang reproducible & optimal.
#
# Variabel yang wajib tersedia saat BUILD (disebar ke client bundle):
#   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SITE_URL
# (opsional: NEXT_PUBLIC_GA_MEASUREMENT_ID, NEXT_PUBLIC_GTM_ID, NEXT_PUBLIC_FB_PIXEL_ID,
#  NEXT_PUBLIC_HOTJAR_ID, NEXT_PUBLIC_HOTJAR_SV)
#
# Semua SECRET server-side (SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET, ADMIN_PASSWORD,
# DISCORD_*, TELEGRAM_*, S3_*, CRON_SECRET, dll) HANYA lewat env saat runtime —
# jangan pernah di-pass sebagai build-arg agar tidak tertanam di image.

# ── Stage 1: Dependencies ─────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

# libc6-compat diperlukan oleh native module (sharp) pada alpine/musl
RUN apk add --no-cache libc6-compat

# Salin manifest lalu install SEMUA dependencies (devDeps diperlukan untuk `next build`)
COPY package.json package-lock.json* ./
# Cache mount BuildKit membuat /root/.npm persist antar build — JANGAN bersihkan di sini
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# ── Stage 2: Builder ──────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

# Public-only build args (NEXT_PUBLIC_* di-inline saat build time)
ARG NEXT_PUBLIC_SUPABASE_URL=""
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=""
ARG NEXT_PUBLIC_SITE_URL=""
ARG NEXT_PUBLIC_GA_MEASUREMENT_ID=""
ARG NEXT_PUBLIC_GTM_ID=""
ARG NEXT_PUBLIC_FB_PIXEL_ID=""
ARG NEXT_PUBLIC_HOTJAR_ID=""
ARG NEXT_PUBLIC_HOTJAR_SV=""

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_GA_MEASUREMENT_ID=$NEXT_PUBLIC_GA_MEASUREMENT_ID \
    NEXT_PUBLIC_GTM_ID=$NEXT_PUBLIC_GTM_ID \
    NEXT_PUBLIC_FB_PIXEL_ID=$NEXT_PUBLIC_FB_PIXEL_ID \
    NEXT_PUBLIC_HOTJAR_ID=$NEXT_PUBLIC_HOTJAR_ID \
    NEXT_PUBLIC_HOTJAR_SV=$NEXT_PUBLIC_HOTJAR_SV \
    NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_OUTPUT=standalone

# Copy dependencies dari stage deps
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Next.js application (cache BuildKit untuk incremental build)
RUN --mount=type=cache,target=/app/.next/cache \
    npm run build

# ── Stage 3: Runner ───────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME="0.0.0.0"

# Create non-root user
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Copy standalone build + static assets + public files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Set correct permissions & run as non-root
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

# Health check (endpoint /api/health sudah tersedia di aplikasi)
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)}).on('error', () => process.exit(1))"

# Graceful shutdown
STOPSIGNAL SIGTERM

# Start the application
CMD ["node", "server.js"]
