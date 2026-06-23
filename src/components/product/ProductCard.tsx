"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ShoppingCart, Check } from "@/components/ui/icons";
import { cn, formatPrice } from "@/lib/utils";
import { useCartStore } from "@/stores/cart-store";
import type { Product } from "@/types";

const BADGE_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  HOT:          { bg: "#FF5E41", color: "#FFFFFF", label: "Hot"         },
  NEW:          { bg: "#34D399", color: "#FFFFFF", label: "New"         },
  LIMITED:      { bg: "#DB9A45", color: "#FFFFFF", label: "Limited"     },
  BEST_SELLER:  { bg: "#7C3AED", color: "#FFFFFF", label: "Best Seller" },
  OUT_OF_STOCK: { bg: "#3B4354", color: "#999999", label: "Sold Out"    },
};

interface ProductCardProps {
  product: Product;
  priority?: boolean; // For above-the-fold products
  loading?: 'eager' | 'lazy';
}

export default function ProductCard({ product, priority = false, loading = 'lazy' }: ProductCardProps) {
  const [hovered,  setHovered]  = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const addItem = useCartStore((s) => s.addItem);

  const mainImage =
    product.images?.[0]?.url ||
    "https://placehold.co/400x400/222329/D3BC8E?text=LEIZ";

  const isOutOfStock = product.stock <= 0;
  const hasDiscount  = product.comparePrice != null && product.comparePrice > product.price;
  const discountPct  = hasDiscount
    ? Math.round((1 - product.price / product.comparePrice!) * 100)
    : 0;
  const isLowStock   = !isOutOfStock && product.stock <= product.minStock;
  const badge        = product.badge ? BADGE_CONFIG[product.badge] : null;

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
      className={cn("group", isOutOfStock && "opacity-70")}
      style={{
        background: "#222329",
        border: `1px solid ${hovered ? "rgba(211,188,142,0.30)" : "#3B4354"}`,
        borderRadius: "8px",
        overflow: "hidden",
        transition: "border-color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease",
        boxShadow: hovered ? "0 8px 24px rgba(0,0,0,0.30)" : "0 2px 8px rgba(0,0,0,0.15)",
        transform: hovered && !isOutOfStock ? "translateY(-2px)" : "translateY(0)",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Link
        href={`/products/${product.slug}`}
        style={{ display: "flex", flexDirection: "column", height: "100%", textDecoration: "none" }}
        tabIndex={0}
        aria-label={`View ${product.name}`}
      >
        {/* Badge accent top bar */}
        {badge && badge.bg !== "#3B4354" && (
          <div
            aria-hidden="true"
            style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", zIndex: 10, background: badge.bg, opacity: 0.85 }}
          />
        )}

        {/* Image */}
        <div style={{ position: "relative", aspectRatio: "1/1", overflow: "hidden", background: "#1A1B20" }}>
          <Image
            src={mainImage}
            alt={product.name}
            fill
            className="object-cover"
            style={{ transform: hovered && !isOutOfStock ? "scale(1.04)" : "scale(1)", transition: "transform 0.6s ease" }}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            priority={priority}
            loading={loading}
            quality={85}
          />

          {/* Vignette */}
          <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(34,35,41,0.85) 0%, transparent 55%)" }} />

          {/* Badge pill */}
          {badge && (
            <span style={{
              position: "absolute", top: "10px", left: "10px", zIndex: 10,
              padding: "3px 8px", borderRadius: "4px",
              background: badge.bg, color: badge.color,
              fontSize: "9.5px", fontFamily: "Helvetica, Arial, system-ui, sans-serif",
              fontWeight: 400, letterSpacing: "0.04em",
            }}>
              {badge.label}
            </span>
          )}

          {/* Discount */}
          {hasDiscount && (
            <span style={{
              position: "absolute", top: "10px", right: "10px", zIndex: 10,
              display: "flex", alignItems: "center", justifyContent: "center",
              width: "32px", height: "32px", borderRadius: "50%",
              background: "rgba(34,35,41,0.90)", border: "1px solid rgba(255,255,255,0.10)",
              fontSize: "10px", fontFamily: "Helvetica, Arial, system-ui, sans-serif",
              fontWeight: 700, color: "#FFFFFF",
            }}>
              -{discountPct}%
            </span>
          )}

          {/* Add to cart — slides on hover */}
          <div
            aria-hidden={isOutOfStock}
            style={{
              position: "absolute", left: 0, right: 0, bottom: 0,
              padding: "0 12px 12px",
              opacity: hovered && !isOutOfStock ? 1 : 0,
              transform: hovered && !isOutOfStock ? "translateY(0)" : "translateY(6px)",
              transition: "opacity 0.25s ease, transform 0.25s ease",
              pointerEvents: hovered && !isOutOfStock ? "auto" : "none",
              zIndex: 10,
            }}
          >
            <button
              onClick={handleAddToCart}
              disabled={isOutOfStock}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px",
                padding: "10px", borderRadius: "4px", border: "none",
                fontFamily: "Helvetica, Arial, system-ui, sans-serif",
                fontSize: "11px", fontWeight: 400, letterSpacing: "0.04em",
                cursor: isOutOfStock ? "not-allowed" : "pointer",
                background: isOutOfStock ? "rgba(255,255,255,0.05)"
                          : justAdded   ? "#34D399"
                          :               "#7C3AED",
                color: isOutOfStock ? "rgba(255,255,255,0.20)" : "#FFFFFF",
                boxShadow: isOutOfStock ? "none" : "0 4px 12px rgba(124,58,237,0.30)",
                transition: "background 0.2s ease",
              }}
              aria-label={justAdded ? "Added to cart" : `Add ${product.name} to cart`}
            >
              {justAdded ? <Check size={11} /> : <ShoppingCart size={11} />}
              {justAdded ? "Added" : isOutOfStock ? "Sold Out" : "Add to Cart"}
            </button>
          </div>
        </div>

        {/* Info */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "16px", flex: 1 }}>

          {/* Category + stock */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "10px", color: "#999999", fontFamily: "Helvetica, Arial, system-ui, sans-serif", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {product.category?.name ?? "Insane DN"}
            </span>
            <span style={{
              fontSize: "10px", fontFamily: "Helvetica, Arial, system-ui, sans-serif",
              color: isOutOfStock ? "#FF5E41" : isLowStock ? "#DB9A45" : "#34D399",
            }}>
              {isOutOfStock ? "Out of stock" : isLowStock ? "Low stock" : "In stock"}
            </span>
          </div>

          {/* Name */}
          <h3 style={{
            fontFamily: "Helvetica, Arial, system-ui, sans-serif",
            fontSize: "14px", fontWeight: 400, lineHeight: 1.4,
            color: hovered ? "#FFFFFF" : "#CCCCCC",
            margin: 0, transition: "color 0.2s ease",
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>
            {product.name}
          </h3>

          {/* Price */}
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "auto", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <span style={{ fontFamily: "Helvetica, Arial, system-ui, sans-serif", fontSize: "18px", fontWeight: 700, color: "#FFFFFF" }}>
              {formatPrice(product.price)}
            </span>
            {hasDiscount && (
              <span style={{ fontSize: "11px", color: "#999999", textDecoration: "line-through" }}>
                {formatPrice(product.comparePrice!)}
              </span>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}
