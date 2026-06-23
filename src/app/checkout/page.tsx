"use client";

import type { CartItem } from "@/types";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CreditCard,
  User,
  Package,
  Copy,
  CheckCircle2,
  FileCheck,
} from "@/components/ui/icons";
import { useCartStore } from "@/stores/cart-store";
import { formatPrice, cn } from "@/lib/utils";

const steps = [
  { id: 1, name: "Customer Info", icon: User },
  { id: 2, name: "Order Review", icon: Package },
  { id: 3, name: "Payment", icon: CreditCard },
  { id: 4, name: "Confirmation", icon: FileCheck },
];

const paymentMethods = [
  { id: "qris", name: "QRIS", icon: "📱", desc: "Scan & Pay" },
  { id: "dana", name: "DANA", icon: "💰", desc: "E-Wallet" },
  { id: "ovo", name: "OVO", icon: "💜", desc: "E-Wallet" },
  { id: "gopay", name: "GoPay", icon: "💚", desc: "E-Wallet" },
  { id: "bank_transfer", name: "Bank Transfer", icon: "🏦", desc: "Manual Transfer" },
];

export default function CheckoutPage() {
  const [step, setStep] = useState(1);
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    discord: "",
    ign: "",
    notes: "",
    paymentMethod: "",
  });

  const cartStore = useCartStore();
  const items: CartItem[] = cartStore.items;
  const getSubtotal = cartStore.getSubtotal;
  const getTax = cartStore.getTax;
  const getTotal = cartStore.getTotal;
  const clearCart = cartStore.clearCart;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleComplete = async () => {
    if (!formData.name || !formData.paymentMethod) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: formData.name,
          customerEmail: formData.email || undefined,
          customerDiscord: formData.discord || undefined,
          customerIGN: formData.ign || undefined,
          customerNotes: formData.notes || undefined,
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
          paymentMethod: formData.paymentMethod,
          currency: "IDR",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to create order");
      }

      setOrderNumber(data.data?.orderNumber || data.orderNumber);
      clearCart();
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (items.length === 0 && step !== 4) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-surface/60 border border-white/5 mb-6 mx-auto">
            <Package className="h-10 w-10 text-text-muted/40" />
          </div>
          <h1 className="text-2xl font-bold text-text mb-4">Your cart is empty</h1>
          <Link
            href="/products"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/20 hover:bg-primary-light transition-all duration-300"
          >
            Browse Products
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen py-10 lg:py-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <Link
          href="/products"
          className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text mb-8 transition-colors group"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform duration-300" />
          Continue Shopping
        </Link>

        <h1 className="text-3xl lg:text-4xl font-bold text-text mb-10">Checkout</h1>

        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-12">
          {steps.map((s, i) => (
            <div key={s.id} className="flex items-center flex-1 last:flex-initial">
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition-all duration-500",
                    step > s.id
                      ? "bg-success text-white shadow-lg shadow-success/20"
                      : step === s.id
                        ? "bg-primary text-white shadow-lg shadow-primary/20 glow-primary"
                        : "bg-surface/60 text-text-muted border border-white/5"
                  )}
                >
                  {step > s.id ? <Check className="h-5 w-5" /> : s.id}
                </div>
                <span
                  className={cn(
                    "text-sm font-medium hidden sm:inline transition-colors duration-300",
                    step >= s.id ? "text-text" : "text-text-muted/50"
                  )}
                >
                  {s.name}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div
                  className={cn(
                    "hidden sm:block h-0.5 flex-1 mx-4 rounded-full transition-all duration-500",
                    step > s.id ? "bg-success" : "bg-surface-light/50"
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="card-premium p-6 sm:p-8 lg:p-10">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
                className="space-y-6"
              >
                <h2 className="text-xl font-semibold text-text">Customer Information</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-text mb-2">Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="input-premium"
                      placeholder="Your name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text mb-2">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="input-premium"
                      placeholder="your@email.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text mb-2">Discord Username *</label>
                    <input
                      type="text"
                      value={formData.discord}
                      onChange={(e) => setFormData({ ...formData, discord: e.target.value })}
                      className="input-premium"
                      placeholder="username#0000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text mb-2">In-Game Name (IGN)</label>
                    <input
                      type="text"
                      value={formData.ign}
                      onChange={(e) => setFormData({ ...formData, ign: e.target.value })}
                      className="input-premium"
                      placeholder="Your in-game name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text mb-2">Notes</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={3}
                      className="input-premium resize-none"
                      placeholder="Any special requests or instructions..."
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
                className="space-y-6"
              >
                <h2 className="text-xl font-semibold text-text">Order Review</h2>
                <div className="space-y-3">
                  {items.map((item: CartItem) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-4 p-4 rounded-2xl bg-surface/40 border border-white/5"
                    >
                      <div className="relative h-16 w-16 flex-shrink-0 rounded-xl overflow-hidden bg-surface/60">
                        <Image src={item.image} alt={item.name} fill className="object-cover" sizes="64px" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium truncate">{item.name}</h3>
                        <p className="text-xs text-text-muted mt-0.5">Qty: {item.quantity}</p>
                      </div>
                      <p className="text-sm font-semibold text-primary">{formatPrice(item.price * item.quantity)}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-2 pt-4 border-t border-white/5">
                  <div className="flex justify-between text-sm text-text-muted">
                    <span>Subtotal</span>
                    <span>{formatPrice(getSubtotal())}</span>
                  </div>
                  <div className="flex justify-between text-sm text-text-muted">
                    <span>Tax (11%)</span>
                    <span>{formatPrice(getTax())}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold pt-2 border-t border-white/5">
                    <span>Total</span>
                    <span className="text-primary">{formatPrice(getTotal())}</span>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
                className="space-y-6"
              >
                <h2 className="text-xl font-semibold text-text">Select Payment Method</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {paymentMethods.map((method) => (
                    <button
                      key={method.id}
                      onClick={() => setFormData({ ...formData, paymentMethod: method.id })}
                      className={cn(
                        "flex flex-col items-center gap-2 p-5 rounded-2xl border-2 transition-all duration-300 active:scale-[0.97]",
                        formData.paymentMethod === method.id
                          ? "border-primary bg-primary/10 shadow-lg shadow-primary/10"
                          : "border-white/5 hover:border-white/10 bg-surface/30"
                      )}
                    >
                      <span className="text-2xl">{method.icon}</span>
                      <span className="text-sm font-medium">{method.name}</span>
                      <span className="text-[10px] text-text-muted/50">{method.desc}</span>
                    </button>
                  ))}
                </div>

                {formData.paymentMethod && (
                  <div className="p-5 rounded-2xl bg-surface/40 border border-white/5 space-y-3">
                    <h3 className="text-sm font-medium text-text">Payment Instructions</h3>
                    <p className="text-sm text-text-muted">
                      Transfer the exact amount to the account below:
                    </p>
                    <div className="flex items-center justify-between p-4 rounded-xl bg-surface/60 border border-white/5">
                      <div>
                        <p className="text-xs text-text-muted/60">Account Number</p>
                        <p className="font-mono font-semibold text-text">1234567890</p>
                      </div>
                      <button
                        onClick={() => handleCopy("1234567890")}
                        className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-surface-light transition-all duration-200"
                      >
                        {copied ? (
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        ) : (
                          <Copy className="h-4 w-4 text-text-muted" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-text-muted/50">
                      After transferring, please confirm your payment on Discord.
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
                className="text-center py-8 space-y-6"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring", bounce: 0.5 }}
                  className="flex h-20 w-20 items-center justify-center rounded-full bg-success/15 mx-auto"
                >
                  <CheckCircle2 className="h-10 w-10 text-success" />
                </motion.div>
                <h2 className="text-2xl font-bold text-text">Order Confirmed!</h2>
                <p className="text-text-muted max-w-md mx-auto">
                  Thank you for your order. We&apos;ve sent the details to your Discord.
                  Please complete the payment and send proof on our Discord server.
                </p>
                {orderNumber && (
                  <div className="inline-flex items-center gap-2 rounded-xl bg-surface/60 border border-white/5 px-6 py-3">
                    <span className="text-sm text-text-muted">Order Number:</span>
                    <span className="font-mono font-bold text-primary">{orderNumber}</span>
                  </div>
                )}
                <div className="flex justify-center">
                  <Link
                    href="/products"
                    className="rounded-full bg-primary px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 hover:bg-primary-light transition-all duration-300"
                  >
                    Continue Shopping
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error Message */}
          {error && (
            <div className="mt-6 p-4 rounded-2xl bg-error/10 border border-error/20 text-sm text-error">
              {error}
            </div>
          )}

          {/* Navigation */}
          {step < 4 && (
            <div className="flex justify-between mt-10 pt-6 border-t border-white/5">
              {step > 1 ? (                  <button
                  onClick={() => { setError(null); setStep(step - 1); }}
                  className="flex items-center gap-2 rounded-full border border-white/10 px-6 py-3 text-sm font-medium text-text-muted hover:text-text hover:bg-surface/40 transition-all duration-300"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
              ) : (
                <div />
              )}
              <button
                onClick={() => (step === 3 ? handleComplete() : setStep(step + 1))}
                disabled={
                  (step === 1 && !formData.name) ||
                  (step === 3 && (!formData.paymentMethod || isSubmitting))
                }
                className={cn(
                  "flex items-center gap-2 rounded-full px-8 py-3.5 text-sm font-semibold transition-all duration-300 active:scale-[0.97]",
                  step === 3
                    ? "bg-success text-white shadow-lg shadow-success/20 hover:bg-success/90"
                    : "bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary-light",
                  ((step === 1 && !formData.name) || (step === 3 && isSubmitting)) && "opacity-50 cursor-not-allowed"
                )}
              >
                {isSubmitting ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Processing...
                  </>
                ) : (
                  <>
                    {step === 3 ? "Complete Order" : "Continue"}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
