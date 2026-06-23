"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ShoppingCart,
  Minus,
  Plus,
  Clock,
  ShieldCheck,
  Zap,
  ChevronRight,
  Loader2,
  Check,
} from "@/components/ui/icons";
import { formatPrice, cn } from "@/lib/utils";
import { useCartStore } from "@/stores/cart-store";
import { useProduct, useProducts } from "@/hooks/use-data";
import ProductCard from "@/components/product/ProductCard";

const BADGE_CONFIG: Record<string, string> = {
  HOT:          "from-rose-500 to-orange-500",
  NEW:          "from-emerald-500 to-teal-500",
  LIMITED:      "from-amber-400 to-yellow-500",
  BEST_SELLER:  "from-violet-500 to-purple-600",
  OUT_OF_STOCK: "from-slate-600 to-slate-700",
};

const FALLBACK = "https://placehold.co/800x800/0D1420/7C3AED?text=LEIZ+STORE";

export default function ProductDetailPage() {
  const params  = useParams();
  const slug    = params.slug as string;
  const { data: product, loading, error } = useProduct(slug);
  const [quantity, setQuantity]       = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [justAdded, setJustAdded]     = useState(false);
  const addItem = useCartStore((s) => s.addItem);

  const { data: relatedData } = useProducts({
    category: product?.category?.slug,
    limit: 4,
  } as any);

  /* ── Loading state ── */
  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center" aria-busy="true">
        <Loader2 className="h-8 w-8 animate-spin text-primary/50" aria-hidden="true" />
      </main>
    );
  }

  /* ── Error / not found ── */
  if (error || !product) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-xs">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0D1420] border border-[#1A2840] mb-6 mx-auto">
            <ShoppingCart className="h-7 w-7 text-text-muted/20" aria-hidden="true" />
          </div>
          <h1 className="text-[18px] font-bold text-text-secondary mb-2">Item not found</h1>
          <p className="text-[13px] text-text-muted/55 mb-6 leading-relaxed">
            {error ?? "This item doesn't exist or has been removed."}
          </p>
          <Link
            href="/products"
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary hover:text-primary-light transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back to Items
          </Link>
        </div>
      </main>
    );
  }

  const isOutOfStock    = product.stock <= 0;
  const hasDiscount     = product.comparePrice != null && product.comparePrice > product.price;
  const discountPct     = hasDiscount
    ? Math.round((1 - product.price / product.comparePrice!) * 100) : 0;
  const isLowStock      = !isOutOfStock && product.stock <= product.minStock;
  const relatedProducts = (relatedData?.items ?? []).filter((p) => p.id !== product.id).slice(0, 4);
  const mainImage       = product.images?.[selectedImage]?.url || product.images?.[0]?.url || FALLBACK;
  const badgeGradient   = product.badge ? BADGE_CONFIG[product.badge] : null;

  const handleAddToCart = () => {
    if (isOutOfStock || justAdded) return;
    for (let i = 0; i < quantity; i++) {
      addItem({
        productId: product.id,
        name:      product.name,
        slug:      product.slug,
        price:     product.price,
        image:     product.images?.[0]?.url ?? FALLBACK,
        unit:      product.unit,
        stock:     product.stock,
      });
    }
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1600);
  };

  return (
    <main className="min-h-screen pb-28">

      {/* ── Breadcrumb ── */}
      <div className="border-b border-white/[0.04] bg-[#060A10]">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12 py-4">
          <nav
            className="flex items-center gap-1.5 text-[11px] text-text-muted/40"
            aria-label="Breadcrumb"
          >
            <Link href="/" className="hover:text-text-muted/70 transition-colors">Home</Link>
            <ChevronRight className="h-2.5 w-2.5" aria-hidden="true" />
            <Link href="/products" className="hover:text-text-muted/70 transition-colors">Items</Link>
            <ChevronRight className="h-2.5 w-2.5" aria-hidden="true" />
            <span className="text-text-muted/65 truncate max-w-[200px]">{product.name}</span>
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12 pt-12 lg:pt-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">

          {/* ── Image panel ── */}
          <motion.div
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.55, ease: [0.32, 0.72, 0, 1] }}
            className="space-y-3"
          >
            {/* Double-bezel image frame */}
            <div className="p-[3px] rounded-[1.5rem] bg-white/[0.03] border border-white/[0.06]">
              <div className="relative aspect-square rounded-[calc(1.5rem-4px)] overflow-hidden bg-[#090F1A]">
                {badgeGradient && (
                  <div
                    aria-hidden="true"
                    className={cn("absolute top-0 left-0 right-0 h-[2px] z-10", `bg-gradient-to-r ${badgeGradient}`)}
                  />
                )}
                <Image
                  src={mainImage}
                  alt={product.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  priority
                />
                {/* Badge pill */}
                {product.badge && badgeGradient && (
                  <span
                    className={cn(
                      "absolute top-4 left-4 z-10 px-2.5 py-1 rounded-md text-[10px] font-bold text-white tracking-[0.04em]",
                      `bg-gradient-to-r ${badgeGradient}`
                    )}
                  >
                    {product.badge.replace("_", " ")}
                  </span>
                )}
                {hasDiscount && (
                  <span className="absolute top-4 right-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[#0D1420]/88 border border-white/10 text-[10px] font-black text-white">
                    -{discountPct}%
                  </span>
                )}
              </div>
            </div>

            {/* Thumbnails */}
            {(product.images?.length ?? 0) > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {product.images.map((img, i) => (
                  <button
                    key={img.id}
                    onClick={() => setSelectedImage(i)}
                    className={cn(
                      "relative h-14 w-14 shrink-0 rounded-xl overflow-hidden border-2 transition-all duration-300",
                      selectedImage === i
                        ? "border-primary shadow-sm shadow-primary/25"
                        : "border-[#1A2840] hover:border-white/18"
                    )}
                    aria-label={`View image ${i + 1}`}
                    aria-pressed={selectedImage === i}
                  >
                    <Image src={img.url} alt="" fill className="object-cover" sizes="56px" />
                  </button>
                ))}
              </div>
            )}
          </motion.div>

          {/* ── Details panel ── */}
          <motion.div
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.55, ease: [0.32, 0.72, 0, 1], delay: 0.07 }}
            className="flex flex-col gap-6"
          >
            {/* Category tag */}
            <span className="text-[10.5px] font-bold uppercase tracking-[0.28em] text-primary/60">
              {product.category?.name ?? "Insane DN"}
            </span>

            {/* Name */}
            <h1
              className="font-black text-keynote leading-[1.05] tracking-[-0.025em]"
              style={{ fontSize: "clamp(28px, 4vw, 46px)" }}
            >
              {product.name}
            </h1>

            {/* Price row */}
            <div className="flex items-baseline gap-3 py-5 border-y border-white/[0.05]">
              <span className="text-[38px] font-black text-white tracking-tight">
                {formatPrice(product.price)}
              </span>
              {hasDiscount && (
                <>
                  <span className="text-[17px] text-text-muted/32 line-through font-normal">
                    {formatPrice(product.comparePrice!)}
                  </span>
                  <span className="text-[10.5px] font-bold text-success bg-success/10 border border-success/20 px-2.5 py-1 rounded-full">
                    Save {discountPct}%
                  </span>
                </>
              )}
            </div>

            {/* Description */}
            <p className="text-[14px] text-text-muted leading-[1.85]">
              {product.description}
            </p>

            {/* What's Included Section */}
            <div className="space-y-3 pt-4 border-t border-white/[0.05]">
              <h3 className="text-[13px] font-semibold text-text uppercase tracking-wider">What's Included</h3>
              <ul className="space-y-2">
                {[
                  `${product.stock} ${product.unit} available`,
                  "Instant digital delivery",
                  "Official game items",
                  "Purchase confirmation via Discord",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] text-text-muted">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0 mt-0.5">
                      <circle cx="8" cy="8" r="6" fill="rgba(211,188,142,0.15)" />
                      <path d="M5.5 8L7 9.5L10.5 6" stroke="#D3BC8E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Delivery Method */}
            <div className="space-y-3 pt-4 border-t border-white/[0.05]">
              <h3 className="text-[13px] font-semibold text-text uppercase tracking-wider">Delivery Method</h3>
              <div className="flex items-start gap-3 p-4 rounded-xl bg-[#0D1420] border border-[#1A2840]">
                <div className="flex h-10 w-10 items-center justify-center flex-shrink-0 rounded-lg bg-primary/10 border border-primary/20">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M10 5C7.5 5 5.5 7 5.5 9.5C5.5 12.5 8 15 10 15C12 15 14.5 12.5 14.5 9.5C14.5 7 12.5 5 10 5Z" fill="#7C3AED" fillOpacity="0.2" />
                    <path d="M10 3V5M10 15V17M3 10H5M15 10H17M5.5 5.5L7 7M13 13L14.5 14.5M14.5 5.5L13 7M7 13L5.5 14.5" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-medium text-text mb-1">Discord Delivery</p>
                  <p className="text-[12px] text-text-muted leading-[1.6]">
                    Items are delivered directly to your Discord DM within 5-10 minutes after payment confirmation. Make sure to join our Discord server.
                  </p>
                </div>
              </div>
            </div>

            {/* How To Redeem */}
            <div className="space-y-3 pt-4 border-t border-white/[0.05]">
              <h3 className="text-[13px] font-semibold text-text uppercase tracking-wider">How To Redeem</h3>
              <ol className="space-y-3">
                {[
                  { step: "1", text: "Complete your purchase and join our Discord server" },
                  { step: "2", text: "Provide your in-game name (IGN) during checkout" },
                  { step: "3", text: "Receive your items via Discord DM within 5-10 minutes" },
                  { step: "4", text: "Log into Dragon Nest Insane DN and check your mailbox" },
                ].map((item) => (
                  <li key={item.step} className="flex items-start gap-3">
                    <div
                      className="flex h-6 w-6 items-center justify-center flex-shrink-0 rounded-md text-[11px] font-bold"
                      style={{ background: "rgba(211,188,142,0.12)", border: "1px solid rgba(211,188,142,0.25)", color: "#D3BC8E" }}
                    >
                      {item.step}
                    </div>
                    <p className="text-[13px] text-text-muted leading-[1.6] pt-0.5">{item.text}</p>
                  </li>
                ))}
              </ol>
            </div>

            {/* Stock indicator */}
            <div className="flex items-center gap-2">
              <div
                aria-hidden="true"
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  isOutOfStock ? "bg-danger" : isLowStock ? "bg-warning animate-pulse-subtle" : "bg-success"
                )}
              />
              <span className={cn(
                "text-[13px] font-semibold",
                isOutOfStock ? "text-danger/80" : isLowStock ? "text-warning/90" : "text-success/80"
              )}>
                {isOutOfStock
                  ? "Out of stock"
                  : `${product.stock} ${product.unit} available${isLowStock ? " — low stock" : ""}`}
              </span>
            </div>

            {/* Quantity + Add to Cart */}
            <div className="flex items-center gap-3">
              {/* Qty stepper */}
              <div
                className="flex items-center rounded-2xl border border-[#1A2840] bg-[#0D1420] p-1 gap-0.5"
                role="group"
                aria-label="Quantity"
              >
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-text-muted hover:text-primary hover:bg-primary/[0.07] transition-all duration-200"
                  aria-label="Decrease quantity"
                  disabled={quantity <= 1}
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span
                  className="w-9 text-center text-[13px] font-bold text-white tabular-nums"
                  aria-label={`Quantity: ${quantity}`}
                >
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                  disabled={isOutOfStock || quantity >= product.stock}
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-text-muted hover:text-primary hover:bg-primary/[0.07] transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Increase quantity"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Add to cart button */}
              <button
                onClick={handleAddToCart}
                disabled={isOutOfStock}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2.5 rounded-2xl py-3.5 text-[13px] font-bold",
                  "transition-all duration-300 active:scale-[0.97]",
                  isOutOfStock
                    ? "bg-white/[0.03] text-text-muted/30 cursor-not-allowed border border-white/[0.05]"
                    : justAdded
                    ? "bg-success/85 text-white shadow-xl shadow-success/18"
                    : "bg-primary text-white hover:bg-primary-light shadow-xl shadow-primary/22 hover:shadow-primary/32"
                )}
                aria-label={
                  isOutOfStock ? "Out of stock" :
                  justAdded    ? "Added to cart" :
                                 "Add to cart"
                }
              >
                {justAdded ? (
                  <>
                    <Check className="h-4 w-4" aria-hidden="true" />
                    Added to Cart
                  </>
                ) : (
                  <>
                    <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                    {isOutOfStock ? "Out of Stock" : "Add to Cart"}
                  </>
                )}
              </button>
            </div>

            {/* Trust row — 3 compact cells */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              {[
                { icon: Zap,         label: "Instant"   },
                { icon: ShieldCheck, label: "Safe"      },
                { icon: Clock,       label: "24/7 Help" },
              ].map((b) => (
                <div
                  key={b.label}
                  className="flex flex-col items-center gap-2 rounded-2xl bg-[#0D1420] border border-[#1A2840] p-3 inner-shine"
                >
                  <b.icon className="h-4 w-4 text-primary/55" aria-hidden="true" />
                  <span className="text-[10px] text-text-muted/45 font-medium">{b.label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* ── Related items ── */}
        {relatedProducts.length > 0 && (
          <motion.section
            className="mt-24 lg:mt-32"
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.55, ease: [0.32, 0.72, 0, 1] }}
            aria-label="Related items"
          >
            <div className="flex items-end justify-between mb-10">
              <div>
                <h2
                  className="font-black text-keynote tracking-[-0.03em] leading-none"
                  style={{ fontSize: "clamp(22px, 2.8vw, 32px)" }}
                >
                  Related Items
                </h2>
              </div>
              <Link
                href="/products"
                className="hidden sm:flex items-center gap-1 text-[12px] font-semibold text-text-muted/45 hover:text-text-secondary transition-colors"
              >
                View all
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
              {relatedProducts.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.07, duration: 0.48 }}
                >
                  <ProductCard product={p} />
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}
      </div>
    </main>
  );
}
