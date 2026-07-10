"use client";

import { useState } from "react";
import Link from "next/link";
import { ShoppingCart, Check } from "@/components/ui/icons";
import { cn, formatPrice } from "@/lib/utils";
import { useCartStore } from "@/stores/cart-store";
import type { Product } from "@/types";

// Gradient class strings — IDENTICAL to BADGE_CONFIG in
// src/app/products/[slug]/page.tsx so the grid and detail page render
// the exact same badge colors for every key (incl. SALE).
const BADGE_CONFIG: Record<string, { gradient: string; label: string }> = {
  HOT:          { gradient: "from-rose-500 to-orange-500",   label: "Hot"        },
  NEW:          { gradient: "from-emerald-500 to-teal-500",  label: "New"        },
  LIMITED:      { gradient: "from-amber-400 to-yellow-500",  label: "Limited"    },
  BEST_SELLER:  { gradient: "from-violet-500 to-purple-600", label: "Best Seller" },
  OUT_OF_STOCK: { gradient: "from-slate-600 to-slate-700",   label: "Sold Out"   },
  SALE:         { gradient: "from-ember to-ember-bright",    label: "Sale"       },
};

interface ProductCardProps {
  product: Product;
  priority?: boolean; // For above-the-fold products
  loading?: 'eager' | 'lazy';
}

const FALLBACK_IMG = "https://placehold.co/400x400/222329/D3BC8E?text=LEIZ";

export default function ProductCard({ product, priority: _priority = false, loading = 'lazy' }: ProductCardProps) {
  const [justAdded, setJustAdded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const addItem = useCartStore((s) => s.addItem);

  const mainImage = imgError
    ? FALLBACK_IMG
    : (product.images?.[0]?.url || FALLBACK_IMG);

  const isOutOfStock = product.stock <= 0;
  const hasDiscount  = product.comparePrice != null && product.comparePrice > product.price;
  const discountPct  = hasDiscount
    ? Math.round((1 - product.price / product.comparePrice!) * 100)
    : 0;
  const isLowStock   = !isOutOfStock && product.stock <= product.minStock;
  const badge        = product.badge ? BADGE_CONFIG[product.badge] : null;
  const showAccentBar = product.badge != null && product.badge !== "OUT_OF_STOCK";

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOutOfStock || justAdded) return;
    addItem({
      productId: product.id,
      name:      product.name,
      slug:      product.slug,
      price:     product.price,
      image:     mainImage,
      unit:      product.unit,
      stock:     product.stock,
    });
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1400);
  };

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg bg-surface border border-border transition-all duration-200",
        "hover:border-ember hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.30)]",
        isOutOfStock && "opacity-70"
      )}
    >
      {/* Image + overlays + Add to Cart (siblings of the navigation Link) */}
      <div className="relative aspect-square overflow-hidden bg-void">
        {/* Badge accent top bar */}
        {showAccentBar && badge && (
          <div
            aria-hidden="true"
            className={cn("absolute top-0 left-0 right-0 z-10 h-0.5 bg-gradient-to-r opacity-85", badge.gradient)}
          />
        )}

        {/* Image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mainImage}
          alt={product.name}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-transform duration-500",
            !isOutOfStock && "group-hover:scale-[1.04]"
          )}
          loading={loading}
          onError={() => setImgError(true)}
        />

        {/* Vignette */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-void/90 to-transparent"
        />

        {/* Badge pill */}
        {badge && (
          <span
            className={cn(
              "absolute left-2.5 top-2.5 z-10 rounded px-2 py-0.5 text-[9.5px] font-normal tracking-[0.04em] text-white",
              "bg-gradient-to-r", badge.gradient
            )}
          >
            {badge.label}
          </span>
        )}

        {/* Discount */}
        {hasDiscount && (
          <span className="absolute right-2.5 top-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-void/90 text-[10px] font-bold text-text-primary">
            -{discountPct}%
          </span>
        )}

        {/* Add to cart — always visible (tappable without hover on touch) */}
        <div className="absolute inset-x-3 bottom-3 z-10">
          <button
            onClick={handleAddToCart}
            disabled={isOutOfStock}
            className={cn(
              "flex w-full items-center justify-center gap-1.5 rounded-md px-2.5 py-2.5 text-[11px] font-normal tracking-[0.04em] transition-all duration-200 active:scale-[0.98]",
              isOutOfStock
                ? "cursor-not-allowed bg-surface-raised text-text-tertiary"
                : justAdded
                ? "bg-success text-white shadow-lg shadow-success/20"
                : "bg-primary text-void shadow-lg shadow-primary/25 hover:bg-ember-bright"
            )}
            aria-label={justAdded ? "Added to cart" : `Add ${product.name} to cart`}
          >
            {justAdded ? <Check size={11} /> : <ShoppingCart size={11} />}
            {justAdded ? "Added" : isOutOfStock ? "Sold Out" : "Add to Cart"}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="flex flex-col gap-2 p-4">
        {/* Category + stock */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
            {product.category?.name ?? "Insane DN"}
          </span>
          <span
            className={cn(
              "text-[10px]",
              isOutOfStock ? "text-error" : isLowStock ? "text-warning" : "text-success"
            )}
          >
            {isOutOfStock ? "Out of stock" : isLowStock ? "Low stock" : "In stock"}
          </span>
        </div>

        {/* Name */}
        <h3 className="line-clamp-2 text-[14px] font-normal leading-snug text-text-primary">
          {product.name}
        </h3>

        {/* Price */}
        <div className="mt-auto flex items-baseline gap-2 border-t border-border pt-3">
          <span className="text-[18px] font-bold text-text-primary">
            {formatPrice(product.price)}
          </span>
          {hasDiscount && (
            <span className="text-[11px] text-text-tertiary line-through">
              {formatPrice(product.comparePrice!)}
            </span>
          )}
        </div>
      </div>

      {/* Full-card navigation overlay (sibling of the Add to Cart button) */}
      <Link
        href={`/products/${product.slug}`}
        className="absolute inset-0 z-0"
        aria-label={`View ${product.name}`}
        tabIndex={0}
      />
    </div>
  );
}
