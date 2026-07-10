"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingCart, X, Menu, Heart, User } from "@/components/ui/icons";
import { useCartStore } from "@/stores/cart-store";
import { cn } from "@/lib/utils";
import type { CartItem } from "@/types";

const navLinks = [
  { href: "/",          label: "Home",       icon: null },
  { href: "/products",   label: "Items",       icon: null },
  { href: "/wishlist",   label: "Wishlist",   icon: Heart },
  { href: "/track",      label: "Track Order", icon: null },
  { href: "/auth/login", label: "Account",    icon: User },
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
          scrolled ? "nav-glass" : "bg-transparent"
        )}
        style={{ height: "66px" }}
      >
        <div
          className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12 h-full flex items-center justify-between"
        >

          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2.5 shrink-0 group no-underline"
            aria-label="LEIZ STORE home"
          >
            <div
              className="flex items-center justify-center w-10 h-10 transition-transform duration-250 group-hover:scale-105"
            >
              <Image
                src="/logo.svg"
                alt="LEIZ STORE"
                width={40}
                height={40}
                priority
                className="w-10 h-10"
              />
            </div>
            <div className="hidden sm:flex items-baseline gap-1">
              <span className="text-[15px] font-bold tracking-[-0.01em] text-text-primary">
                LEIZ
              </span>
              <span className="text-[15px] font-light tracking-[0.12em] text-text-tertiary">
                STORE
              </span>
            </div>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const active =
                pathname === link.href ||
                (link.href !== "/" && pathname.startsWith(link.href));
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "relative flex items-center gap-1.5 h-[66px] px-4",
                    "text-sm font-normal transition-colors duration-200",
                    "no-underline border-b-2",
                    active
                      ? "text-text-primary border-arcane"
                      : "text-text-secondary border-transparent hover:text-text-primary"
                  )}
                >
                  {Icon && <Icon size={15} className="flex-shrink-0" />}
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">

            {/* Cart */}
            <button
              onClick={() => setIsOpen(true)}
              className="relative flex items-center justify-center w-9 h-9 rounded text-text-secondary hover:text-text-primary hover:bg-surface-raised transition-colors duration-200 cursor-pointer"
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
                    className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[15px] h-[15px] px-0.5 rounded-full bg-arcane text-white text-[8px] font-bold"
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
              className="hidden md:inline-flex items-center px-4 py-2 rounded text-[13px] bg-arcane/10 border border-arcane/25 text-arcane transition-colors duration-200 hover:bg-arcane/20 hover:border-arcane/40 no-underline"
            >
              Shop Now
            </Link>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden flex items-center justify-center w-9 h-9 rounded text-text-secondary hover:text-text-primary hover:bg-surface-raised transition-colors duration-200 cursor-pointer"
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

        {/* Ornament bottom border line on scroll */}
        {scrolled && (
          <div
            aria-hidden="true"
            className="absolute bottom-0 left-0 right-0 h-px dn-divider"
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
              className="absolute inset-0 bg-black/65 backdrop-blur-md"
              onClick={() => setMobileOpen(false)}
            />

            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", bounce: 0, duration: 0.32 }}
              className="absolute right-0 top-0 bottom-0 w-[270px] bg-surface-raised border-l border-border flex flex-col"
            >
              {/* Panel header */}
              <div className="flex items-center justify-between px-6 h-[66px] border-b border-border">
                <div className="flex items-center gap-2">
                  <Image
                    src="/logo.svg"
                    alt="LEIZ STORE"
                    width={28}
                    height={28}
                    className="w-7 h-7"
                  />
                  <div className="flex items-baseline gap-1">
                    <span className="text-[13px] font-bold text-text-primary">LEIZ</span>
                    <span className="text-[13px] font-light tracking-[0.12em] text-text-tertiary">STORE</span>
                  </div>
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded text-text-tertiary hover:text-text-primary transition-colors duration-200 cursor-pointer"
                  aria-label="Close menu"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Nav links */}
              <nav className="flex-1 p-4" aria-label="Mobile navigation">
                {navLinks.map((link, i) => {
                  const active =
                    pathname === link.href ||
                    (link.href !== "/" && pathname.startsWith(link.href));
                  const Icon = link.icon;
                  return (
                    <motion.div
                      key={link.href}
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 * (i + 1), duration: 0.22 }}
                      className="mb-1"
                    >
                      <Link
                        href={link.href}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "flex items-center gap-2 px-4 py-3 rounded text-sm font-normal no-underline transition-colors duration-200 border",
                          active
                            ? "text-arcane bg-arcane/10 border-arcane/20"
                            : "text-text-secondary border-transparent hover:text-text-primary"
                        )}
                      >
                        {Icon && <Icon size={15} className="flex-shrink-0" />}
                        {link.label}
                      </Link>
                    </motion.div>
                  );
                })}
              </nav>

              {/* CTA */}
              <div className="p-4 pb-8 flex flex-col gap-2">
                <Link
                  href="/products"
                  onClick={() => setMobileOpen(false)}
                  className="btn-primary w-full justify-center rounded"
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
