"use client";

import { useEffect, useRef } from "react";
import type { CartItem } from "@/types";
import { useCartStore } from "@/stores/cart-store";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Minus, Trash2, ShoppingBag, ArrowRight } from "@/components/ui/icons";
import { formatPrice } from "@/lib/utils";

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

  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Capture the opener and move focus into the dialog when it opens;
  // restore focus to the opener when it closes (dialog pattern).
  useEffect(() => {
    if (isOpen) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
      panelRef.current?.focus();
    } else if (previouslyFocusedRef.current) {
      previouslyFocusedRef.current.focus();
    }
  }, [isOpen]);

  // Lock background scroll while the drawer is open (aria-modal content).
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  // Escape closes the drawer; Tab is trapped inside the dialog.
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
        return;
      }

      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);

      if (focusables.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, setIsOpen]);

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
            className="bg-black/65 backdrop-blur-[6px]"
            style={{ position: "fixed", inset: 0, zIndex: 50 }}
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", bounce: 0, duration: 0.38 }}
            className="bg-void border-l border-border outline-none"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-drawer-title"
            tabIndex={-1}
            ref={panelRef}
            style={{
              position: "fixed", right: 0, top: 0, zIndex: 50,
              height: "100%", width: "100%", maxWidth: "420px",
              display: "flex", flexDirection: "column",
            }}
          >
            {/* ── Header ── */}
            <div className="border-b border-border" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", height: "66px", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div className="flex items-center justify-center w-[34px] h-[34px] rounded bg-ember-dim border border-ember">
                  <ShoppingBag size={15} className="text-ember" />
                </div>
                <span id="cart-drawer-title" className="text-[15px] text-text-primary">
                  Shopping Cart
                </span>
                {getItemCount() > 0 && (
                  <span className="flex items-center justify-center min-w-[20px] h-[20px] rounded-[10px] bg-ember px-1.5 text-[10px] font-bold text-void">
                    {getItemCount()}
                  </span>
                )}
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-center w-8 h-8 rounded text-text-tertiary cursor-pointer transition-colors hover:text-text-primary"
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
                  <div className="flex items-center justify-center w-[72px] h-[72px] rounded-lg bg-surface border border-border mb-5">
                    <ShoppingBag size={28} className="text-text-tertiary opacity-35" />
                  </div>
                  <p className="text-[15px] text-text-secondary mb-2">
                    Your cart is empty
                  </p>
                  <p className="text-[13px] text-text-tertiary mb-6">
                    Browse the catalog and add items to get started.
                  </p>
                  <Link
                    href="/products"
                    onClick={() => setIsOpen(false)}
                    className="btn-primary"
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
                      className="flex gap-3 p-3.5 rounded-lg bg-surface-raised border border-border mb-2"
                    >
                      {/* Thumbnail */}
                      <div className="relative w-16 h-16 rounded bg-void overflow-hidden flex-shrink-0">
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          className="object-cover"
                          sizes="64px"
                          onError={(e) => {
                            const target = e.currentTarget as HTMLImageElement;
                            target.src = "https://placehold.co/400x400/222329/D3BC8E?text=LEIZ";
                          }}
                        />
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 className="text-[13px] text-text-primary mb-1 overflow-hidden text-ellipsis whitespace-nowrap">
                          {item.name}
                        </h3>
                        <p className="text-[14px] font-bold text-text-primary mb-2.5">
                          {formatPrice(item.price)}
                        </p>

                        {/* Qty + delete row */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          {/* Qty stepper */}
                          <div className="flex items-center rounded border border-border bg-void p-0.5">
                            <button
                              onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                              className="flex items-center justify-center w-[26px] h-[26px] rounded bg-transparent border-none text-text-tertiary cursor-pointer transition-colors hover:text-ember hover:bg-ember-dim"
                              aria-label="Decrease quantity"
                            >
                              <Minus size={11} />
                            </button>
                            <span className="w-7 text-center text-[13px] text-text-primary">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                              className="flex items-center justify-center w-[26px] h-[26px] rounded bg-transparent border-none text-text-tertiary cursor-pointer transition-colors hover:text-ember hover:bg-ember-dim"
                              aria-label="Increase quantity"
                            >
                              <Plus size={11} />
                            </button>
                          </div>

                          {/* Delete */}
                          <button
                            onClick={() => removeItem(item.productId)}
                            className="flex items-center justify-center w-7 h-7 rounded bg-transparent border-none text-error/45 cursor-pointer transition-colors hover:text-error"
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
              <div className="border-t border-border" style={{ padding: "20px 16px", flexShrink: 0 }}>

                {/* Totals */}
                <div className="mb-4">
                  {[
                    { label: "Subtotal", value: formatPrice(getSubtotal()) },
                    { label: "Tax (11%)", value: formatPrice(getTax()) },
                  ].map((row) => (
                    <div key={row.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                      <span className="text-[13px] text-text-tertiary">{row.label}</span>
                      <span className="text-[13px] text-text-tertiary">{row.value}</span>
                    </div>
                  ))}
                  <div className="border-t border-border" style={{ display: "flex", justifyContent: "space-between", paddingTop: "10px", marginTop: "8px" }}>
                    <span className="text-[15px] text-text-primary">Total</span>
                    <span className="text-[16px] font-bold text-text-primary">
                      {formatPrice(getTotal())}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={clearCart}
                    className="flex items-center justify-center px-4 py-2.5 rounded border border-border bg-transparent text-[13px] text-text-tertiary cursor-pointer transition-colors hover:text-text-primary hover:border-text-tertiary"
                  >
                    Clear
                  </button>
                  <Link
                    href="/checkout"
                    onClick={() => setIsOpen(false)}
                    className="btn-primary flex-1"
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
