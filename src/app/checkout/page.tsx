"use client";

import type { CartItem } from "@/types";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CreditCard,
  User,
  Package,
  CheckCircle2,
  FileCheck,
  Clock,
} from "@/components/ui/icons";
import { useCartStore } from "@/stores/cart-store";
import { formatPrice, cn } from "@/lib/utils";
import { PAYMENT_ACCOUNTS } from "@/lib/payment/constants";

const steps = [
  { id: 1, name: "Customer Info", icon: User },
  { id: 2, name: "Order Review", icon: Package },
  { id: 3, name: "Payment", icon: CreditCard },
  { id: 4, name: "Confirmation", icon: FileCheck },
];

const paymentMethods = [
  ...PAYMENT_ACCOUNTS.map((a) => ({
    id: a.method,
    name: a.label,
    icon: a.icon,
    desc: `Transfer ke ${a.accountName}`,
  })),
];


export default function CheckoutPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    discord: "",
    ign: "",
    notes: "",
    paymentMethod: "bank_transfer",
  });

  const cartStore = useCartStore();
  const items: CartItem[] = cartStore.items;
  const getSubtotal = cartStore.getSubtotal;
  const getTotal = cartStore.getTotal;
  const clearCart = cartStore.clearCart;

  const handleComplete = async () => {
    if (!formData.name) return;

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

      const orderData = data.data || data;
      setOrderNumber(orderData.orderNumber);

      if (orderData.id) {
        clearCart();
        router.push(`/payment/${orderData.id}`);
        return;
      }
      
      throw new Error("Invalid order response");
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
                    <label className="block text-sm font-medium text-text mb-2">Discord ID / Username *</label>
                    <input
                      type="text"
                      value={formData.discord}
                      onChange={(e) => setFormData({ ...formData, discord: e.target.value })}
                      className="input-premium"
                      placeholder="Discord ID atau username"
                    />
                    <p className="text-xs text-text-muted/60 mt-1">Wajib diisi untuk notifikasi pembayaran</p>
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
                <h2 className="text-xl font-semibold text-text">Metode Pembayaran</h2>

                <div className="space-y-3">
                  {paymentMethods.map((pm) => (
                    <button
                      key={pm.id}
                      onClick={() => setFormData({ ...formData, paymentMethod: pm.id })}
                      className={cn(
                        "w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all duration-300 text-left",
                        formData.paymentMethod === pm.id
                          ? "border-primary/40 bg-primary/5 shadow-lg shadow-primary/5"
                          : "border-white/5 bg-surface/40 hover:border-white/10"
                      )}
                    >
                      <span className="text-3xl">{pm.icon}</span>
                      <div className="flex-1">
                        <p className="font-semibold text-text">{pm.name}</p>
                        <p className="text-xs text-text-muted/60 mt-0.5">{pm.desc}</p>
                      </div>
                      {formData.paymentMethod === pm.id && (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                          <Check className="h-3.5 w-3.5 text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
                className="py-4 space-y-6"
              >
                <div className="text-center space-y-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring", bounce: 0.5 }}
                    className="flex h-20 w-20 items-center justify-center rounded-full bg-success/15 mx-auto"
                  >
                    <CheckCircle2 className="h-10 w-10 text-success" />
                  </motion.div>
                  <h2 className="text-2xl font-bold text-text">Order Confirmed!</h2>

                  {orderNumber && (
                    <div className="inline-flex items-center gap-2 rounded-xl bg-surface/60 border border-white/5 px-6 py-3">
                      <span className="text-sm text-text-muted">Order Number:</span>
                      <span className="font-mono font-bold text-primary">{orderNumber}</span>
                    </div>
                  )}
                </div>



                <div className="flex justify-center pt-4">
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
              {step > 1 ? (
                <button
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
                  (step === 1 && (!formData.name || !formData.discord)) ||
                  (step === 3 && isSubmitting)
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
                    {step === 3 ? "Buat Order & Bayar" : "Continue"}
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
