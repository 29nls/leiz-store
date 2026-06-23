"use client";

import type { CartItem } from "@/types";
import { useCartStore } from "@/stores/cart-store";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Minus, Trash2, ShoppingBag, ArrowRight } from "@/components/ui/icons";
import { formatPrice } from "@/lib/utils";

/* ── DN design tokens ── */
const S = {
  bg:        "#222329",
  border:    "#3B4354",
  borderSub: "rgba(255,255,255,0.06)",
  gold:      "#D3BC8E",
  goldBg:    "rgba(211,188,142,0.08)",
  text:      "#FFFFFF",
  textSec:   "#CCCCCC",
  textMuted: "#999999",
  primary:   "#7C3AED",
  danger:    "#FF5E41",
  success:   "#34D399",
  font:      "Helvetica, Arial, system-ui, sans-serif",
};

export default function CartDrawer() {
  const cartStore      = useCartStore();
  const items: CartItem[] = cartStore.items;
  const isOpen: boolean   = cartStore.isOpen;
  const setIsOpen      = cartStore.setIsOpen;
  const removeItem     = cartStore.removeItem;
  const updateQuantity = cartStore.updateQuantity;
  const clearCart      = cartStore.clearCart;
  const getSubtotal    = cartStore.getSubtotal;
  const getTax         = cartStore.getTax;
  const getTotal       = cartStore.getTotal;
  const getItemCount   = cartStore.getItemCount;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
            onClick={() => setIsOpen(false)}
          />

          {/* Drawer panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", bounce: 0, duration: 0.38 }}
            style={{
              position: "fixed", right: 0, top: 0, zIndex: 50,
              height: "100%", width: "100%", maxWidth: "420px",
              background: S.bg,
              borderLeft: `1px solid rgba(211,188,142,0.10)`,
              display: "flex", flexDirection: "column",
            }}
          >
            {/* ── Header ── */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", height: "66px", borderBottom: `1px solid rgba(211,188,142,0.08)`, flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "34px", height: "34px", borderRadius: "4px", background: S.goldBg, border: `1px solid rgba(211,188,142,0.18)` }}>
                  <ShoppingBag size={15} style={{ color: S.gold }} />
                </div>
                <span style={{ fontFamily: S.font, fontSize: "15px", fontWeight: 400, color: S.text }}>
                  Shopping Cart
                </span>
                {getItemCount() > 0 && (
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", minWidth: "20px", height: "20px", borderRadius: "10px", background: S.primary, padding: "0 6px", fontFamily: S.font, fontSize: "10px", fontWeight: 700, color: "#FFFFFF" }}>
                    {getItemCount()}
                  </span>
                )}
              </div>
              <button
                onClick={() => setIsOpen(false)}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px", borderRadius: "4px", background: "none", border: "none", color: S.textMuted, cursor: "pointer", transition: "color 0.2s ease" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = S.text)}
                onMouseLeave={(e) => (e.currentTarget.style.color = S.textMuted)}
                aria-label="Close cart"
              >
                <X size={16} />
              </button>
            </div>

            {/* ── Items ── */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px" }}>
              {items.length === 0 ? (
                /* Empty state */
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center", padding: "40px 24px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "72px", height: "72px", borderRadius: "8px", background: "rgba(255,255,255,0.03)", border: `1px solid ${S.border}`, marginBottom: "20px" }}>
                    <ShoppingBag size={28} style={{ color: "rgba(153,153,153,0.35)" }} />
                  </div>
                  <p style={{ fontFamily: S.font, fontSize: "15px", color: S.textSec, marginBottom: "8px" }}>
                    Your cart is empty
                  </p>
                  <p style={{ fontFamily: S.font, fontSize: "13px", color: S.textMuted, marginBottom: "24px" }}>
                    Browse the catalog and add items to get started.
                  </p>
                  <Link
                    href="/products"
                    onClick={() => setIsOpen(false)}
                    className="btn-primary"
                    style={{ fontSize: "13px" }}
                  >
                    Browse Items
                  </Link>
                </div>
              ) : (
                <AnimatePresence>
                  {items.map((item: CartItem) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 80 }}
                      transition={{ duration: 0.25 }}
                      style={{ display: "flex", gap: "12px", padding: "14px", borderRadius: "8px", background: "#1A1B20", border: `1px solid ${S.border}`, marginBottom: "8px" }}
                    >
                      {/* Thumbnail */}
                      <div style={{ position: "relative", width: "64px", height: "64px", borderRadius: "4px", overflow: "hidden", flexShrink: 0, background: "#222329" }}>
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{ fontFamily: S.font, fontSize: "13px", fontWeight: 400, color: S.text, marginBottom: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.name}
                        </h3>
                        <p style={{ fontFamily: S.font, fontSize: "14px", fontWeight: 700, color: S.text, marginBottom: "10px" }}>
                          {formatPrice(item.price)}
                        </p>

                        {/* Qty + delete row */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          {/* Qty stepper */}
                          <div style={{ display: "flex", alignItems: "center", borderRadius: "4px", border: `1px solid ${S.border}`, background: "#222329", padding: "2px" }}>
                            <button
                              onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                              style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "26px", height: "26px", borderRadius: "4px", background: "none", border: "none", color: S.textMuted, cursor: "pointer", transition: "color 0.2s ease, background 0.2s ease" }}
                              onMouseEnter={(e) => { e.currentTarget.style.color = S.gold; e.currentTarget.style.background = S.goldBg; }}
                              onMouseLeave={(e) => { e.currentTarget.style.color = S.textMuted; e.currentTarget.style.background = "none"; }}
                              aria-label="Decrease quantity"
                            >
                              <Minus size={11} />
                            </button>
                            <span style={{ width: "28px", textAlign: "center", fontFamily: S.font, fontSize: "13px", color: S.text }}>
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                              style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "26px", height: "26px", borderRadius: "4px", background: "none", border: "none", color: S.textMuted, cursor: "pointer", transition: "color 0.2s ease, background 0.2s ease" }}
                              onMouseEnter={(e) => { e.currentTarget.style.color = S.gold; e.currentTarget.style.background = S.goldBg; }}
                              onMouseLeave={(e) => { e.currentTarget.style.color = S.textMuted; e.currentTarget.style.background = "none"; }}
                              aria-label="Increase quantity"
                            >
                              <Plus size={11} />
                            </button>
                          </div>

                          {/* Delete */}
                          <button
                            onClick={() => removeItem(item.productId)}
                            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", borderRadius: "4px", background: "none", border: "none", color: "rgba(255,94,65,0.45)", cursor: "pointer", transition: "color 0.2s ease" }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = S.danger)}
                            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,94,65,0.45)")}
                            aria-label={`Remove ${item.name}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>

            {/* ── Footer ── */}
            {items.length > 0 && (
              <div style={{ borderTop: `1px solid rgba(211,188,142,0.08)`, padding: "20px 16px", flexShrink: 0 }}>

                {/* Totals */}
                <div style={{ marginBottom: "16px" }}>
                  {[
                    { label: "Subtotal", value: formatPrice(getSubtotal()) },
                    { label: "Tax (11%)", value: formatPrice(getTax()) },
                  ].map((row) => (
                    <div key={row.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                      <span style={{ fontFamily: S.font, fontSize: "13px", color: S.textMuted }}>{row.label}</span>
                      <span style={{ fontFamily: S.font, fontSize: "13px", color: S.textMuted }}>{row.value}</span>
                    </div>
                  ))}
                  <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "10px", borderTop: `1px solid rgba(255,255,255,0.06)`, marginTop: "8px" }}>
                    <span style={{ fontFamily: S.font, fontSize: "15px", fontWeight: 400, color: S.text }}>Total</span>
                    <span style={{ fontFamily: S.font, fontSize: "16px", fontWeight: 700, color: S.text }}>
                      {formatPrice(getTotal())}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={clearCart}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center",
                      padding: "10px 16px", borderRadius: "4px",
                      border: `1px solid ${S.border}`, background: "transparent",
                      fontFamily: S.font, fontSize: "13px", color: S.textMuted,
                      cursor: "pointer", transition: "color 0.2s ease, border-color 0.2s ease",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = S.text; e.currentTarget.style.borderColor = "#999999"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = S.textMuted; e.currentTarget.style.borderColor = S.border; }}
                  >
                    Clear
                  </button>
                  <Link
                    href="/checkout"
                    onClick={() => setIsOpen(false)}
                    style={{
                      flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                      padding: "10px 16px", borderRadius: "4px",
                      background: S.primary, color: "#FFFFFF",
                      fontFamily: S.font, fontSize: "13px", fontWeight: 400,
                      textDecoration: "none",
                      boxShadow: "0 4px 16px rgba(124,58,237,0.28)",
                      transition: "background 0.2s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#9F5FFF")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = S.primary)}
                  >
                    Checkout
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
