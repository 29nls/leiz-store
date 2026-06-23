"use client";

import Link from "next/link";
import { 
  ArrowRight
} from "@/components/ui/icons";
import { SlideUp } from "@/components/ui/animated";

export default function HomePage() {

  return (
    <main className="min-h-screen overflow-x-hidden">

      {/* ═══════════════════════════════════════
          HERO SECTION — Dark Gaming Premium
      ═══════════════════════════════════════ */}
      <section className="relative min-h-[100dvh] flex items-center overflow-hidden">

        {/* Background Layers */}
        <div className="absolute inset-0 bg-[#0A0B0F]">
          {/* Grid pattern */}
          <div 
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)`,
              backgroundSize: "64px 64px",
            }}
          />
          
          {/* Cyber glow - top */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] opacity-20"
            style={{
              background: "radial-gradient(circle, rgba(0,240,255,0.4) 0%, transparent 70%)",
              filter: "blur(100px)",
            }}
          />
          
          {/* Purple accent glow - bottom right */}
          <div
            className="absolute bottom-0 right-0 w-[800px] h-[600px] opacity-15"
            style={{
              background: "radial-gradient(circle, rgba(123,47,247,0.4) 0%, transparent 70%)",
              filter: "blur(100px)",
            }}
          />
        </div>

        {/* Hero Content - MAX 4 elements */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 w-full">
          <div className="flex flex-col items-start max-w-3xl">
            {/* 1. Eyebrow Badge - gaming style */}
            <SlideUp
              delay={0}
              duration={0.4}
              className="inline-flex items-center gap-2 mb-8 bg-white/5 border border-white/10 
                         rounded-full px-4 py-2 backdrop-blur-sm"
            >
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span 
                className="text-[11px] uppercase tracking-[0.2em] text-cyan-400 font-mono font-medium"
              >
                Insane Dragon Nest
              </span>
            </SlideUp>

            {/* 2. Headline - MAX 2 lines, bold statement */}
            <SlideUp
              delay={0.06}
              duration={0.4}
              className="text-6xl sm:text-7xl lg:text-8xl font-bold tracking-tight mb-6"
            >
              <span className="block text-white">Premium Items.</span>
              <span className="block text-transparent bg-clip-text bg-gradient-to-r 
                             from-cyan-400 to-purple-400">
                Instant Delivery.
              </span>
            </SlideUp>

            {/* 3. Subtext - MAX 20 words, clear value prop */}
            <SlideUp
              delay={0.12}
              duration={0.4}
              className="text-lg text-zinc-400 mb-10 leading-relaxed max-w-[480px]"
            >
              DNP, pouches, gold & coupons. Secure payment, Discord delivery in 5 minutes.
            </SlideUp>

            {/* 4. CTAs - 1 primary + 1 secondary */}
            <SlideUp 
              delay={0.18}
              duration={0.4}
              className="flex flex-wrap gap-4"
            >
              <Link 
                href="/products" 
                className="btn-primary group"
              >
                Browse Items
                <ArrowRight size={20} className="group-hover:translate-x-0.5 transition-transform" strokeWidth={2.5} />
              </Link>
              <Link 
                href="/track" 
                className="btn-secondary"
              >
                Track Order
              </Link>
            </SlideUp>
          </div>
        </div>

        {/* Bottom fade */}
        <div 
          className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
          style={{
            background: "linear-gradient(to top, #0A0B0F 0%, transparent 100%)",
          }}
        />
      </section>

  </main>
  );
}
