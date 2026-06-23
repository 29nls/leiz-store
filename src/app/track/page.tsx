"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Package,
  Clock,
  CreditCard,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Copy,
  CheckCircle,
  AlertCircle,
} from "@/components/ui/icons";
import { formatPrice, cn } from "@/lib/utils";

interface OrderItem {
  name: string;
  price: number;
  quantity: number;
  total: number;
}

interface OrderData {
  orderNumber: string;
  status: string;
  customerName: string;
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  paymentMethod: string;
  createdAt: string;
  paidAt: string | null;
  completedAt: string | null;
  items: OrderItem[];
  payment: {
    method: string;
    status: string;
    paidAt: string | null;
  } | null;
}

const statusConfig: Record<
  string,
  { label: string; icon: typeof CheckCircle2; color: string; bg: string; description: string }
> = {
  pending: {
    label: "Pending",
    icon: Clock,
    color: "text-warning",
    bg: "bg-warning/15",
    description: "Your order has been received and is awaiting review.",
  },
  waiting_payment: {
    label: "Awaiting Payment",
    icon: CreditCard,
    color: "text-accent",
    bg: "bg-accent/15",
    description: "Please complete your payment to proceed.",
  },
  paid: {
    label: "Paid",
    icon: CheckCircle2,
    color: "text-success",
    bg: "bg-success/15",
    description: "Payment confirmed! Your order is being processed.",
  },
  processing: {
    label: "Processing",
    icon: Package,
    color: "text-primary",
    bg: "bg-primary/15",
    description: "Your order is being prepared for delivery.",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    color: "text-success",
    bg: "bg-success/15",
    description: "Your order has been delivered successfully!",
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    color: "text-error",
    bg: "bg-error/15",
    description: "This order has been cancelled.",
  },
  refunded: {
    label: "Refunded",
    icon: ArrowLeft,
    color: "text-text-muted",
    bg: "bg-surface/60",
    description: "This order has been refunded.",
  },
};

const allStatuses = ["pending", "waiting_payment", "paid", "processing", "completed"];

function StatusTimeline({ currentStatus }: { currentStatus: string }) {
  const currentIdx = allStatuses.indexOf(currentStatus);
  const isTerminal = currentStatus === "cancelled" || currentStatus === "refunded";

  return (
    <div className="space-y-0">
      {allStatuses.map((status, i) => {
        const config = statusConfig[status];
        const Icon = config.icon;
        const isCompleted = !isTerminal && i <= currentIdx;
        const isCurrent = !isTerminal && status === currentStatus;

        return (
          <div key={status} className="flex gap-4">
            {/* Vertical line + dot */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full transition-all duration-500 border-2",
                  isCompleted
                    ? "bg-success border-success text-white shadow-lg shadow-success/20"
                    : isCurrent
                      ? "bg-primary/20 border-primary text-primary shadow-lg shadow-primary/20 glow-primary"
                      : "bg-surface/40 border-white/5 text-text-muted/30"
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              {i < allStatuses.length - 1 && (
                <div
                  className={cn(
                    "w-0.5 h-8 rounded-full transition-all duration-500",
                    isCompleted && !isCurrent ? "bg-success" : "bg-surface-light/50"
                  )}
                />
              )}
            </div>

            {/* Label + description */}
            <div className="pb-6 pt-0.5">
              <p
                className={cn(
                  "text-sm font-medium transition-colors duration-300",
                  isCompleted || isCurrent ? "text-text" : "text-text-muted/40"
                )}
              >
                {config.label}
              </p>
              {isCurrent && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-text-muted/60 mt-0.5"
                >
                  {config.description}
                </motion.p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function TrackOrderPage() {
  const [orderNumber, setOrderNumber] = useState("");
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = orderNumber.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setOrder(null);

    try {
      const res = await fetch(`/api/orders/track?orderNumber=${encodeURIComponent(trimmed.toUpperCase())}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || "Order not found");
      }

      setOrder(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

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

        <h1 className="text-3xl lg:text-4xl font-bold text-text mb-2">Track Your Order</h1>
        <p className="text-text-muted mb-10">
          Enter your order number to check the current status and details.
        </p>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="mb-10">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted/40" />
              <input
                type="text"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="e.g. LZ-20260622-A1B2C3"
                className="input-premium pl-12 uppercase tracking-wider font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !orderNumber.trim()}
              className={cn(
                "flex items-center gap-2 rounded-full px-8 py-3.5 text-sm font-semibold transition-all duration-300 active:scale-[0.97]",
                "bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary-light",
                (loading || !orderNumber.trim()) && "opacity-50 cursor-not-allowed"
              )}
            >
              {loading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  Track
                </>
              )}
            </button>
          </div>
        </form>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-8 p-4 rounded-2xl bg-error/10 border border-error/20 flex items-center gap-3"
            >
              <AlertCircle className="h-5 w-5 text-error flex-shrink-0" />
              <p className="text-sm text-error">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Order Result */}
        <AnimatePresence mode="wait">
          {order && (
            <motion.div
              key={order.orderNumber}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
              className="space-y-6"
            >
              {/* Order Header */}
              <div className="card-premium p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h2 className="text-xl font-bold text-text">Order Details</h2>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                          statusConfig[order.status]?.bg,
                          statusConfig[order.status]?.color
                        )}
                      >
                        {(() => {
                          const SIcon = statusConfig[order.status]?.icon || Clock;
                          return <SIcon className="h-3.5 w-3.5" />;
                        })()}
                        {statusConfig[order.status]?.label || order.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-text-muted">{order.orderNumber}</span>
                      <button
                        onClick={() => handleCopy(order.orderNumber)}
                        className="text-text-muted/40 hover:text-text-muted transition-colors"
                      >
                        {copied ? (
                          <CheckCircle className="h-4 w-4 text-success" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary">{formatPrice(order.total)}</p>
                    <p className="text-xs text-text-muted mt-0.5">{formatDate(order.createdAt)}</p>
                  </div>
                </div>

                {/* Status Timeline */}
                <div className="p-5 rounded-2xl bg-surface/30 border border-white/5">
                  <h3 className="text-sm font-semibold text-text mb-4">Order Progress</h3>
                  <StatusTimeline currentStatus={order.status} />
                </div>
              </div>

              {/* Items */}
              <div className="card-premium p-6 sm:p-8">
                <h3 className="text-sm font-semibold text-text mb-4">Items Ordered</h3>
                <div className="space-y-3">
                  {order.items.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-4 rounded-2xl bg-surface/40 border border-white/5"
                    >
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium truncate">{item.name}</h4>
                        <p className="text-xs text-text-muted mt-0.5">
                          {formatPrice(item.price)} × {item.quantity}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-primary ml-4">{formatPrice(item.total)}</p>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="space-y-2 pt-4 mt-4 border-t border-white/5">
                  <div className="flex justify-between text-sm text-text-muted">
                    <span>Subtotal</span>
                    <span>{formatPrice(order.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-text-muted">
                    <span>Tax (11%)</span>
                    <span>{formatPrice(order.tax)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold pt-2 border-t border-white/5">
                    <span>Total</span>
                    <span className="text-primary">{formatPrice(order.total)}</span>
                  </div>
                </div>
              </div>

              {/* Payment Info */}
              <div className="card-premium p-6 sm:p-8">
                <h3 className="text-sm font-semibold text-text mb-4">Payment Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-surface/30 border border-white/5">
                    <p className="text-xs text-text-muted/60 mb-1">Method</p>
                    <p className="text-sm font-medium capitalize">
                      {order.paymentMethod?.replace("_", " ")}
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-surface/30 border border-white/5">
                    <p className="text-xs text-text-muted/60 mb-1">Payment Status</p>
                    <p
                      className={cn(
                        "text-sm font-medium capitalize",
                        order.payment?.status === "verified"
                          ? "text-success"
                          : order.payment?.status === "paid"
                            ? "text-success"
                            : "text-warning"
                      )}
                    >
                      {order.payment?.status || "Awaiting Payment"}
                    </p>
                  </div>
                  {order.paidAt && (
                    <div className="p-4 rounded-2xl bg-surface/30 border border-white/5">
                      <p className="text-xs text-text-muted/60 mb-1">Paid At</p>
                      <p className="text-sm font-medium">{formatDate(order.paidAt)}</p>
                    </div>
                  )}
                  {order.completedAt && (
                    <div className="p-4 rounded-2xl bg-surface/30 border border-white/5">
                      <p className="text-xs text-text-muted/60 mb-1">Completed At</p>
                      <p className="text-sm font-medium">{formatDate(order.completedAt)}</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
