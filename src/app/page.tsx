"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Zap,
  ShieldCheck,
  Clock,
  MessageSquare,
  Star,
  Loader2,
  Package,
} from "@/components/ui/icons";
import { SlideUp } from "@/components/ui/animated";
import ProductCard from "@/components/product/ProductCard";
import { useProducts } from "@/hooks/use-data";
import { supabase } from "@/lib/supabase";

/* ─── Testimonial data (graceful column handling) ─────────────── */

type TestimonialRow = Record<string, unknown>;

function pickText(row: TestimonialRow, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function useTestimonials() {
  const [rows, setRows] = useState<TestimonialRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("testimonial")
          .select("*")
          .limit(6);
        if (cancelled) return;
        if (error) {
          setFailed(true);
          return;
        }
        setRows(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { rows, failed };
}

function Testimonials() {
  const { rows, failed } = useTestimonials();

  const items =
    rows
      ?.map((r) => ({
        quote: pickText(r, ["quote", "content", "testimonial", "message", "text"]),
        author: pickText(r, ["author", "name", "customer_name", "player", "username"]),
        role: pickText(r, ["role", "title", "game", "rank", "status"]),
      }))
      .filter((t) => t.quote) ?? [];

  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
        <SlideUp className="mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary">
            What Players Say
          </h2>
          <p className="mt-3 text-text-secondary">
            Real reviews from the Dragon Nest community.
          </p>
          <div className="mt-4 h-px w-24 dn-ornament-line" />
        </SlideUp>

        {rows === null ? (
          <div className="flex items-center gap-3 text-text-secondary/45">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
            <span className="text-[13px]" role="status">Loading player stories…</span>
          </div>
        ) : failed || items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-border bg-surface py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-void border border-border">
              <MessageSquare className="h-6 w-6 text-text-secondary/20" aria-hidden="true" />
            </div>
            <p className="text-[14px] font-semibold text-text-secondary">
              Player stories coming soon.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.slice(0, 3).map((t, i) => (
              <div
                key={i}
                className="dn-card flex flex-col gap-4 p-6"
              >
                <div className="flex items-center gap-1 text-ember" aria-hidden="true">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star key={s} size={14} fill="currentColor" className="text-ember" />
                  ))}
                </div>
                <p className="text-[15px] leading-relaxed text-text-primary">
                  “{t.quote}”
                </p>
                <div className="mt-auto pt-2 border-t border-border">
                  <p className="text-[13px] font-medium text-text-primary">
                    {t.author || "Anonymous Player"}
                  </p>
                  {t.role && (
                    <p className="text-[12px] text-text-secondary/70">{t.role}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ─── Trust strip ──────────────────────────────────────────────── */

const TRUST_ITEMS = [
  { icon: Zap, label: "Instant Discord Delivery" },
  { icon: ShieldCheck, label: "Manual-Verified Payments" },
  { icon: Clock, label: "Active Since 2024" },
];

/* ─── Home ────────────────────────────────────────────────────── */

export default function HomePage() {
  const { data, loading } = useProducts({ featured: true, limit: 8 });
  const featured = data?.items ?? [];

  return (
    <main className="min-h-screen overflow-x-hidden">

      {/* ═══════════════════════════════════════
          HERO — "Cinematic Shell" (Ember & Arcane)
      ═══════════════════════════════════════ */}
      <section className="relative min-h-[100dvh] flex items-center overflow-hidden">
        {/* Background layers — token + global classes only */}
        <div className="absolute inset-0 bg-void" />
        <div className="absolute inset-0 gradient-hero-enhanced" />
        <div className="absolute inset-0 dn-hero-glow" />

        {/* Hero Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 w-full">
          <div className="flex flex-col items-start max-w-3xl">
            {/* 1. Eyebrow badge */}
            <SlideUp
              delay={0}
              duration={0.4}
              className="inline-flex items-center gap-2 mb-8 bg-ember/10 border border-border rounded-full px-4 py-2 backdrop-blur-sm"
            >
              <span className="w-2 h-2 rounded-full bg-ember animate-pulse" />
              <span className="text-[11px] uppercase tracking-[0.2em] text-ember font-mono font-medium">
                Insane Dragon Nest
              </span>
            </SlideUp>

            {/* 2. Headline — MAX 2 lines */}
            <SlideUp
              delay={0.06}
              duration={0.4}
              className="text-6xl sm:text-7xl lg:text-8xl font-bold tracking-tight mb-6"
            >
              <span className="block text-text-primary">Premium Items.</span>
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-ember to-arcane">
                Instant Delivery.
              </span>
            </SlideUp>

            {/* 3. Subtext — one sentence */}
            <SlideUp
              delay={0.12}
              duration={0.4}
              className="text-lg text-text-secondary mb-10 leading-relaxed max-w-[480px]"
            >
              DNP, pouches, gold & coupons. Secure payment, Discord delivery in 5 minutes.
            </SlideUp>

            {/* 4. CTAs */}
            <SlideUp
              delay={0.18}
              duration={0.4}
              className="flex flex-wrap gap-4"
            >
              <Link href="/products" className="btn-primary group">
                Browse Items
                <ArrowRight size={20} className="group-hover:translate-x-0.5 transition-transform" strokeWidth={2.5} />
              </Link>
              <Link href="/track" className="btn-secondary font-mono">
                Track Order
              </Link>
            </SlideUp>
          </div>
        </div>

        {/* Bottom fade */}
        <div
          className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none bg-gradient-to-t from-void to-transparent"
          aria-hidden="true"
        />
      </section>

      {/* ═══════════════════════════════════════
          TRUST STRIP
      ═══════════════════════════════════════ */}
      <section className="relative border-y border-border bg-surface">
        <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12 py-6">
          <ul className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-4 sm:gap-10">
            {TRUST_ITEMS.map((item) => (
              <li
                key={item.label}
                className="flex items-center gap-2.5 text-[13px] text-text-secondary"
              >
                <item.icon size={18} className="text-ember" aria-hidden="true" />
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          FEATURED ITEMS (Phase 1.4)
      ═══════════════════════════════════════ */}
      <section className="relative py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
          <SlideUp className="mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary">
              Featured This Week
            </h2>
            <p className="mt-3 text-text-secondary">
              Hand-picked deals from the Dragon Nest marketplace.
            </p>
            <div className="mt-4 h-px w-24 dn-ornament-line" />
          </SlideUp>

          {loading ? (
            <div className="flex items-center gap-3 text-text-secondary/45 py-20">
              <Loader2 className="h-7 w-7 animate-spin" aria-hidden="true" />
              <span className="text-[13px]" role="status">Loading featured items…</span>
            </div>
          ) : featured.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4">
              {featured.map((product, i) => (
                <div
                  key={product.id}
                  className="animate-fade-in"
                  style={{ animationDelay: `${i * 0.04}s` }}
                >
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-border bg-surface py-20 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-void border border-border">
                <Package className="h-7 w-7 text-text-secondary/20" aria-hidden="true" />
              </div>
              <p className="text-[14px] font-semibold text-text-secondary">
                Featured items will appear here once added from the admin panel.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════
          TESTIMONIALS
      ═══════════════════════════════════════ */}
      <Testimonials />

      {/* ═══════════════════════════════════════
          CLOSING CTA
      ═══════════════════════════════════════ */}
      <section className="relative py-24 sm:py-32 overflow-hidden">
        <div className="absolute inset-0 dn-cta-glow" aria-hidden="true" />
        <div className="relative mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
          <div className="dn-card flex flex-col items-center gap-6 px-6 py-16 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary max-w-2xl">
              Ready to gear up your Dragon Nest account?
            </h2>
            <p className="text-text-secondary max-w-xl">
              Browse the full catalog of items, gold, and coupons, all with instant Discord delivery.
            </p>
            <Link href="/products" className="btn-primary group">
              Browse Full Catalog
              <ArrowRight size={20} className="group-hover:translate-x-0.5 transition-transform" strokeWidth={2.5} />
            </Link>
          </div>
        </div>
      </section>

    </main>
  );
}
