"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingCart, X, Menu } from "@/components/ui/icons";
import { useCartStore } from "@/stores/cart-store";
import { cn } from "@/lib/utils";
import type { CartItem } from "@/types";

const navLinks = [
  { href: "/",         label: "Home"        },
  { href: "/products", label: "Items"       },
  { href: "/track",    label: "Track Order" },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled,   setScrolled]   = useState(false);
  const pathname = usePathname();
  const { items, setIsOpen } = useCartStore();

  const itemCount = items.reduce(
    (sum: number, item: CartItem) => sum + item.quantity,
    0
  );

  useEffect(() => {
    const handle = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", handle, { passive: true });
    return () => window.removeEventListener("scroll", handle);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  return (
    <>
      {/* ── Main nav bar — full-width, 66px, DN spec ── */}
      <nav
        aria-label="Main navigation"
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-400",
          scrolled ? "glass-strong" : "bg-transparent"
        )}
        style={{
          height: "66px",
          transition: "background 0.4s ease, border-color 0.4s ease, backdrop-filter 0.4s ease",
        }}
      >
        <div
          className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12 h-full flex items-center justify-between"
        >

          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2.5 shrink-0 group"
            aria-label="LEIZ STORE home"
            style={{ textDecoration: "none" }}
          >
            <div
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: "40px", height: "40px",
                transition: "transform 0.25s ease",
              }}
              className="group-hover:scale-105"
            >
              <Image
                src="/logo.svg"
                alt="LEIZ STORE"
                width={40}
                height={40}
                priority
                style={{ width: "40px", height: "40px" }}
              />
            </div>
            <div className="hidden sm:flex items-baseline gap-1">
              <span style={{ fontSize: "15px", fontFamily: "Helvetica, Arial, system-ui, sans-serif", fontWeight: 700, color: "#FFFFFF", letterSpacing: "-0.01em" }}>
                LEIZ
              </span>
              <span style={{ fontSize: "15px", fontFamily: "Helvetica, Arial, system-ui, sans-serif", fontWeight: 300, color: "#999999", letterSpacing: "0.12em" }}>
                STORE
              </span>
            </div>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center" style={{ gap: "4px" }}>
            {navLinks.map((link) => {
              const active =
                pathname === link.href ||
                (link.href !== "/" && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  style={{
                    position: "relative",
                    padding: "0 16px",
                    height: "66px",
                    display: "flex", alignItems: "center",
                    fontFamily: "Helvetica, Arial, system-ui, sans-serif",
                    fontSize: "14px",
                    fontWeight: 400,
                    color: active ? "#FFFFFF" : "#CCCCCC",
                    textDecoration: "none",
                    transition: "color 0.2s ease",
                    borderBottom: active ? "2px solid #7C3AED" : "2px solid transparent",
                  }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = "#D3BC8E"; }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = "#CCCCCC"; }}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Right actions */}
          <div className="flex items-center" style={{ gap: "8px" }}>

            {/* Cart */}
            <button
              onClick={() => setIsOpen(true)}
              className="relative flex items-center justify-center"
              style={{
                width: "36px", height: "36px", borderRadius: "4px",
                background: "transparent", border: "none",
                color: "#CCCCCC", cursor: "pointer",
                transition: "color 0.2s ease, background 0.2s ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#FFFFFF"; e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "#CCCCCC"; e.currentTarget.style.background = "transparent"; }}
              aria-label={`Open cart${itemCount > 0 ? `, ${itemCount} items` : ""}`}
            >
              <ShoppingCart size={17} />
              <AnimatePresence>
                {itemCount > 0 && (
                  <motion.span
                    key={itemCount}
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.4, opacity: 0 }}
                    transition={{ type: "spring", bounce: 0.5, duration: 0.3 }}
                    style={{
                      position: "absolute", top: "-2px", right: "-2px",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      minWidth: "15px", height: "15px",
                      borderRadius: "50%", background: "#7C3AED",
                      fontSize: "8px", fontWeight: 700, color: "#FFFFFF",
                      padding: "0 3px",
                    }}
                    aria-hidden="true"
                  >
                    {itemCount > 9 ? "9+" : itemCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>

            {/* Shop CTA — desktop */}
            <Link
              href="/products"
              className="hidden md:inline-flex items-center"
              style={{
                padding: "8px 16px", borderRadius: "4px",
                background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.25)",
                fontFamily: "Helvetica, Arial, system-ui, sans-serif",
                fontSize: "13px", fontWeight: 400, color: "#A78BFA",
                textDecoration: "none",
                transition: "background 0.2s ease, border-color 0.2s ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(124,58,237,0.20)"; e.currentTarget.style.borderColor = "rgba(124,58,237,0.40)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(124,58,237,0.12)"; e.currentTarget.style.borderColor = "rgba(124,58,237,0.25)"; }}
            >
              Shop Now
            </Link>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden flex items-center justify-center"
              style={{
                width: "36px", height: "36px", borderRadius: "4px",
                background: "transparent", border: "none",
                color: "#CCCCCC", cursor: "pointer",
                transition: "color 0.2s ease, background 0.2s ease",
              }}
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
            >
              <AnimatePresence mode="wait" initial={false}>
                {mobileOpen ? (
                  <motion.div key="x"
                    initial={{ rotate: -45, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 45, opacity: 0 }}
                    transition={{ duration: 0.14 }}
                  >
                    <X size={18} />
                  </motion.div>
                ) : (
                  <motion.div key="menu"
                    initial={{ rotate: 45, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -45, opacity: 0 }}
                    transition={{ duration: 0.14 }}
                  >
                    <Menu size={18} />
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </div>

        </div>

        {/* Gold ornament bottom border line on scroll */}
        {scrolled && (
          <div
            aria-hidden="true"
            style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, rgba(211,188,142,0.18) 30%, rgba(211,188,142,0.18) 70%, transparent)" }}
          />
        )}
      </nav>

      {/* Spacer */}
      <div style={{ height: "66px" }} aria-hidden="true" />

      {/* ── Mobile overlay ── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40 md:hidden"
          >
            <div
              className="absolute inset-0"
              style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)" }}
              onClick={() => setMobileOpen(false)}
            />

            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", bounce: 0, duration: 0.32 }}
              style={{
                position: "absolute", right: 0, top: 0, bottom: 0, width: "270px",
                background: "#222329", borderLeft: "1px solid rgba(211,188,142,0.10)",
                display: "flex", flexDirection: "column",
              }}
            >
              {/* Panel header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", height: "66px", borderBottom: "1px solid rgba(211,188,142,0.08)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Image
                    src="/logo.svg"
                    alt="LEIZ STORE"
                    width={28}
                    height={28}
                    style={{ width: "28px", height: "28px" }}
                  />
                  <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
                    <span style={{ fontSize: "13px", fontFamily: "Helvetica, Arial, system-ui, sans-serif", fontWeight: 700, color: "#FFFFFF" }}>LEIZ</span>
                    <span style={{ fontSize: "13px", fontFamily: "Helvetica, Arial, system-ui, sans-serif", fontWeight: 300, color: "#999999", letterSpacing: "0.12em" }}>STORE</span>
                  </div>
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  style={{ width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "4px", background: "none", border: "none", color: "#999999", cursor: "pointer" }}
                  aria-label="Close menu"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Nav links */}
              <nav style={{ flex: 1, padding: "20px 16px" }} aria-label="Mobile navigation">
                {navLinks.map((link, i) => {
                  const active =
                    pathname === link.href ||
                    (link.href !== "/" && pathname.startsWith(link.href));
                  return (
                    <motion.div
                      key={link.href}
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 * (i + 1), duration: 0.22 }}
                    >
                      <Link
                        href={link.href}
                        onClick={() => setMobileOpen(false)}
                        style={{
                          display: "flex", alignItems: "center",
                          padding: "12px 16px", borderRadius: "4px",
                          fontFamily: "Helvetica, Arial, system-ui, sans-serif",
                          fontSize: "14px", fontWeight: 400,
                          color: active ? "#A78BFA" : "#CCCCCC",
                          textDecoration: "none", marginBottom: "4px",
                          background: active ? "rgba(124,58,237,0.10)" : "transparent",
                          border: active ? "1px solid rgba(124,58,237,0.20)" : "1px solid transparent",
                          transition: "color 0.2s ease, background 0.2s ease",
                        }}
                      >
                        {link.label}
                      </Link>
                    </motion.div>
                  );
                })}
              </nav>

              {/* CTA */}
              <div style={{ padding: "16px", paddingBottom: "32px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <Link
                  href="/products"
                  onClick={() => setMobileOpen(false)}
                  className="btn-primary"
                  style={{ width: "100%", justifyContent: "center", borderRadius: "4px" }}
                >
                  Browse Items
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
