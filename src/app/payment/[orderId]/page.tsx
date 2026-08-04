"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  Copy,
  Check,
  AlertCircle,
  XCircle,
  CreditCard,
  UploadCloud,
  ImagePlus,
} from "@/components/ui/icons";
import { formatPrice, cn } from "@/lib/utils";
import { PAYMENT_ACCOUNTS, type PaymentAccount } from "@/lib/payment/constants";
import { subscribeToRow } from "@/lib/supabase-browser";
import { getStatusStyle } from "@/lib/status-colors";

interface OrderData {
  id: string;
  order_number: string;
  customer_name: string;
  buyer_discord_id?: string;
  customer_discord?: string;
  total: number;
  payment_method: string;
  status: string;
  expiry_at?: string;
  confirmed_at?: string;
  created_at: string;
  order_item?: Array<{ name: string; quantity: number; price: number }>;
  payment_confirmation?: Array<{ id: string }>;
}

function getStatusDisplay(status: string) {
  const style = getStatusStyle(status);
  const iconMap: Record<string, typeof Clock> = {
    PENDING_PAYMENT: Clock,
    WAITING_CONFIRMATION: Clock,
    PAID: CheckCircle2,
    NEEDS_REVIEW: AlertCircle,
    REJECTED: XCircle,
    CANCELLED: XCircle,
    FORCE_CANCELLED: XCircle,
    EXPIRED: XCircle,
  };
  return {
    label: style.label,
    color: style.color,
    icon: iconMap[status] || Clock,
  };
}

function CountdownTimer({ expiryAt }: { expiryAt: string }) {
  const [timeLeft, setTimeLeft] = useState("");
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const update = () => {
      const now = Date.now();
      const expiry = new Date(expiryAt).getTime();
      const diff = expiry - now;

      if (diff <= 0) {
        setTimeLeft("00:00:00");
        setIsExpired(true);
        return;
      }

      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiryAt]);

  return (
    <div className={cn("font-mono text-2xl font-bold", isExpired ? "text-error" : "text-warning")}>
      {timeLeft}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 rounded-lg bg-surface/60 border border-border px-3 py-1.5 text-xs text-text-secondary hover:text-text hover:bg-surface transition-all"
    >
      {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
       {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function PaymentAccountCard({ account, amount }: { account: PaymentAccount; amount: number }) {
  return (
    <div className="p-5 rounded-lg bg-surface/40 border border-border space-y-3">
      <div className="flex items-center gap-3">
        <account.icon className="h-7 w-7 text-primary" />
        <div>
          <p className="font-semibold text-text">{account.label}</p>
          {account.bankName && (
            <p className="text-xs text-text-secondary">{account.bankName}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between p-3 rounded-lg bg-surface/60 border border-border">
          <div>
             <p className="text-xs text-text-secondary">Account Number / ID</p>
            <p className="font-mono font-semibold text-text mt-0.5">{account.accountNumber}</p>
          </div>
          <CopyButton text={account.accountNumber} />
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg bg-surface/60 border border-border">
          <div>
             <p className="text-xs text-text-secondary">Account Holder</p>
            <p className="font-semibold text-text mt-0.5">{account.accountName}</p>
          </div>
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
          <div>
             <p className="text-xs text-text-secondary">Transfer Amount</p>
            <p className="font-mono text-lg font-bold text-primary mt-0.5">{formatPrice(amount)}</p>
          </div>
          <CopyButton text={String(amount)} />
        </div>
      </div>
    </div>
  );
}

export default function PaymentPage() {
  const params = useParams();
  const orderId = params?.orderId as string;
  const [proofMimeType, setProofMimeType] = useState<string | null>(null);

  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
  const [paymentProofName, setPaymentProofName] = useState<string | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [statusChanged, setStatusChanged] = useState(false);
  const [previousStatus, setPreviousStatus] = useState<string | null>(null);
  const statusChangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size <= 0 || file.size > 5 * 1024 * 1024) {
      setError("Image must be between 1 byte and 5MB");
      return;
    }

    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
    if (!allowedTypes.has(file.type)) {
      setError("Please upload a JPEG, PNG, WebP, or AVIF image");
      return;
    }

    setPaymentProofFile(file);
    setPaymentProofName(file.name);
    setProofMimeType(file.type);
    setError(null);
  };

  const loadOrder = useCallback(async () => {
    if (!orderId) return;
    try {
      const res = await fetch(`/api/orders/track?orderId=${orderId}`);
      if (res.ok) {
        const data = await res.json();
        setOrder(data.data);
        setError(null);
      }
    } catch {
      setError("Failed to load order data");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  // Initial load
  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  // Real-time subscription to order changes (single filtered channel)
  useEffect(() => {
    if (!orderId) return;

    let mounted = true;

    const cleanup = subscribeToRow(
      "order",
      `id=eq.${orderId}`,
      (payload) => {
        if (!mounted) return;
        if (payload.new && payload.new.id === orderId) {
          const newOrder = payload.new as OrderData;
          setOrder((prev) => {
            if (prev && prev.status !== newOrder.status) {
              setPreviousStatus(prev.status);
              setStatusChanged(true);
              if (statusChangeTimerRef.current) clearTimeout(statusChangeTimerRef.current);
              statusChangeTimerRef.current = setTimeout(() => setStatusChanged(false), 5000);
            }
            return newOrder;
          });
          setRealtimeConnected(true);
        }
      },
      "UPDATE",
      `payment-realtime-${orderId}`
    );

    return () => {
      mounted = false;
      cleanup();
      if (statusChangeTimerRef.current) clearTimeout(statusChangeTimerRef.current);
    };
  }, [orderId]);

  // Fallback polling (only if realtime fails)
  useEffect(() => {
    if (!orderId) return;
    const interval = setInterval(() => {
      if (!realtimeConnected) loadOrder();
    }, 30000);
    return () => clearInterval(interval);
  }, [orderId, realtimeConnected, loadOrder]);

  const handleConfirmTransfer = async () => {
    if (!order || confirming) return;

    setConfirming(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("buyerName", order.customer_name);
      formData.append("buyerDiscordId", order.buyer_discord_id || order.customer_discord || "");
      formData.append("note", "");
      if (paymentProofFile) formData.append("paymentProof", paymentProofFile);

      const res = await fetch(`/api/orders/${orderId}/confirm`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setConfirmed(true);
        // Update local state
        setOrder((prev) =>
          prev ? { ...prev, status: "WAITING_CONFIRMATION" } : prev
        );
      } else {
        setError(data.error?.message || "Failed to confirm transfer");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/30 border-t-primary mx-auto" />
           <p className="text-text-secondary text-sm">Loading payment details…</p>
        </div>
      </main>
    );
  }

  if (error && !order) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <XCircle className="h-12 w-12 text-error mx-auto" />
          <h1 className="text-xl font-bold text-text">{error}</h1>
          <Link
            href="/products"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white"
          >
            Back to Products
          </Link>
        </div>
      </main>
    );
  }

  if (!order) return null;

  const statusDisplay = getStatusDisplay(order.status);
  const StatusIcon = statusDisplay.icon;
  const paymentAccount = PAYMENT_ACCOUNTS.find(
    (a) => a.method === order.payment_method
  );
  const isPayable = order.status === "PENDING_PAYMENT";
  const isWaiting = order.status === "WAITING_CONFIRMATION";
  const isPaid = order.status === "PAID";
  const isTerminal = ["CANCELLED", "FORCE_CANCELLED", "EXPIRED"].includes(order.status);

  return (
    <main className="min-h-screen py-10 lg:py-16">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <Link
          href="/products"
          className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text mb-8 transition-colors group"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
          Back to Products
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl lg:text-3xl font-bold text-text mb-2">
            Payment Instructions
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-text-secondary">Order:</span>
            <span className="font-mono font-bold text-primary">
              {order.order_number}
            </span>
          </div>
        </div>

        {/* Status Banner */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "flex items-center gap-3 p-4 rounded-lg border border-border mb-8",
            getStatusStyle(order.status).bg
          )}
        >
          <StatusIcon className={cn("h-5 w-5", statusDisplay.color)} />
          <span className={cn("text-sm font-medium", statusDisplay.color)}>
            {statusDisplay.label}
          </span>
          {/* Connection indicator */}
          <div className="ml-auto flex items-center gap-1.5"              title={realtimeConnected ? "Real-time connected" : "Connecting…"}>
            <span className={cn(
              "h-2 w-2 rounded-full",
              realtimeConnected ? "bg-success animate-pulse" : "bg-text-muted/30"
            )} />
            <span className="text-xs text-text-secondary/60 hidden sm:inline">
              {realtimeConnected ? "Live" : "..."}
            </span>
          </div>
        </motion.div>

        {/* Real-time status change notification */}
        <AnimatePresence>
          {statusChanged && previousStatus && (
            <motion.div
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              className="mb-6 overflow-hidden"
            >
              <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/10 border border-primary/20">
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                <div className="text-sm">
                   <span className="text-text-secondary">Status updated: </span>
                  <span className={cn("font-medium", getStatusDisplay(previousStatus).color)}>
                    {getStatusDisplay(previousStatus).label}
                  </span>
                  <span className="text-text-secondary"> → </span>
                  <span className={cn("font-medium", statusDisplay.color)}>
                    {statusDisplay.label}
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Payment Success */}
        {isPaid && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-12 space-y-4"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", bounce: 0.5 }}
              className="flex h-20 w-20 items-center justify-center rounded-full bg-success/15 mx-auto"
            >
              <CheckCircle2 className="h-10 w-10 text-success" />
            </motion.div>
            <h2 className="text-2xl font-bold text-text">
              Payment Confirmed!
            </h2>
            <p className="text-text-secondary">
              Your order is being processed. We'll send a notification to
              your Discord.
            </p>
          </motion.div>
        )}

        {/* Terminal state (cancelled/expired) */}
        {isTerminal && (
          <div className="text-center py-12 space-y-4">
            <XCircle className="h-16 w-16 text-error mx-auto" />
            <h2 className="text-xl font-bold text-text">
              Order {statusDisplay.label}
            </h2>
            <Link
              href="/products"            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white"
          >
               Shop Again
            </Link>
          </div>
        )}

        {/* Payment Instructions (only when payable or waiting) */}
        {(isPayable || isWaiting || confirmed) && (
          <div className="space-y-6">
            {/* Countdown Timer */}
            {isPayable && order.expiry_at && (
              <div className="text-center p-6 rounded-lg bg-surface/40 border border-border">
                <p className="text-sm text-text-secondary mb-2">
                  Payment Deadline
                </p>
                <CountdownTimer expiryAt={order.expiry_at} />
                <p className="text-xs text-text-secondary/60 mt-2">
                   Complete your payment before time runs out
                </p>
                <p className="text-xs text-text-tertiary text-center mt-2">
                  Orders are usually confirmed within 15–30 minutes during active hours.
                </p>
              </div>
            )}

            {/* Payment Account Details */}
            {paymentAccount && (
              <PaymentAccountCard
                account={paymentAccount}
                amount={order.total}
              />
            )}

            {/* All Payment Accounts (if no specific match) */}
            {!paymentAccount && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-text flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                   Choose Payment Method
                </h3>
                {PAYMENT_ACCOUNTS.map((acc) => (
                  <PaymentAccountCard
                    key={acc.method}
                    account={acc}
                    amount={order.total}
                  />
                ))}
              </div>
            )}

            {/* Confirm Button */}
            {isPayable && !confirmed && (
              <>
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-text flex items-center gap-2">
                    <UploadCloud className="h-4 w-4" />
                     Upload Payment Proof
                  </h3>
                  <label className="block w-full rounded-lg border-2 border-dashed border-border bg-surface/40 p-6 text-center cursor-pointer hover:border-primary/50 transition-colors">
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={handleFileChange} className="hidden" />
                    {paymentProofFile ? (
                      <div className="space-y-2">
                        <CheckCircle2 className="h-8 w-8 text-success mx-auto" />
                         <p className="text-sm font-medium text-success">{paymentProofName}</p>
                         <p className="text-xs text-text-secondary">{proofMimeType || "Image"} · Click to change</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <ImagePlus className="h-8 w-8 text-text-secondary mx-auto" />
                         <p className="text-sm font-medium text-text">Choose or drop an image here</p>
                         <p className="text-xs text-text-secondary">Max 5MB (JPG, PNG)</p>
                      </div>
                    )}
                  </label>
                </div>

                {error && (
                  <div className="p-4 rounded-lg bg-error/10 border border-error/20 text-sm text-error">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleConfirmTransfer}
                  disabled={confirming}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 rounded-lg px-8 py-4 text-sm font-semibold transition-all duration-300 active:scale-[0.98]",
                    "bg-success text-white shadow-lg shadow-success/20 hover:bg-success/80",
                    confirming && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {confirming ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                       Processing…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-5 w-5" />
                       I've Made the Transfer
                    </>
                  )}
                </button>
              </>
            )}

            {/* Waiting Confirmation State */}
            {(isWaiting || confirmed) && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center p-6 rounded-lg bg-ember/10 border border-ember/20 space-y-3"
              >
                <div className="h-10 w-10 animate-pulse rounded-full bg-ember/20 flex items-center justify-center mx-auto">
                  <Clock className="h-5 w-5 text-ember" />
                </div>
                <h3 className="font-semibold text-text">
                  Awaiting Verification
                </h3>
                <p className="text-sm text-text-secondary">
                   Your transfer has been confirmed. An admin will verify your
                  payment. You'll get a notification via Discord.
                </p>
              </motion.div>
            )}
          </div>
        )}

        {/* Order Summary */}
        <div className="mt-8 p-5 rounded-lg bg-surface/40 border border-border space-y-3">
           <h3 className="text-sm font-semibold text-text">Order Summary</h3>
          {order.order_item?.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-text-secondary">
                {item.name} x{item.quantity}
              </span>
              <span className="text-text">
                {formatPrice(Number(item.price) * item.quantity)}
              </span>
            </div>
          ))}
          <div className="flex justify-between text-sm font-bold pt-2 border-t border-border">
            <span>Total</span>
            <span className="text-primary">{formatPrice(order.total)}</span>
          </div>
        </div>
      </div>
    </main>
  );
}
