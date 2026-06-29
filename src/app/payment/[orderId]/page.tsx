"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
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
  const map: Record<string, { label: string; color: string; icon: typeof Clock }> = {
    PENDING_PAYMENT: { label: "Menunggu Pembayaran", color: "text-amber-400", icon: Clock },
    WAITING_CONFIRMATION: { label: "Menunggu Verifikasi Admin", color: "text-blue-400", icon: Clock },
    PAID: { label: "Pembayaran Dikonfirmasi", color: "text-emerald-400", icon: CheckCircle2 },
    NEEDS_REVIEW: { label: "Perlu Pengecekan Ulang", color: "text-orange-400", icon: AlertCircle },
    REJECTED: { label: "Pembayaran Ditolak", color: "text-red-400", icon: XCircle },
    CANCELLED: { label: "Dibatalkan", color: "text-red-400", icon: XCircle },
    FORCE_CANCELLED: { label: "Dibatalkan oleh Admin", color: "text-red-400", icon: XCircle },
    EXPIRED: { label: "Kedaluwarsa", color: "text-text-muted", icon: XCircle },
  };
  return map[status] || { label: status, color: "text-text-muted", icon: Clock };
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
    <div className={cn("font-mono text-2xl font-bold", isExpired ? "text-red-400" : "text-amber-400")}>
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
      className="inline-flex items-center gap-1 rounded-lg bg-surface/60 border border-white/5 px-3 py-1.5 text-xs text-text-muted hover:text-text hover:bg-surface transition-all"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied!" : "Salin"}
    </button>
  );
}

function PaymentAccountCard({ account, amount }: { account: PaymentAccount; amount: number }) {
  return (
    <div className="p-5 rounded-2xl bg-surface/40 border border-white/5 space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{account.icon}</span>
        <div>
          <p className="font-semibold text-text">{account.label}</p>
          {account.bankName && (
            <p className="text-xs text-text-muted">{account.bankName}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between p-3 rounded-xl bg-surface/60 border border-white/5">
          <div>
            <p className="text-xs text-text-muted">Nomor Rekening / ID</p>
            <p className="font-mono font-semibold text-text mt-0.5">{account.accountNumber}</p>
          </div>
          <CopyButton text={account.accountNumber} />
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl bg-surface/60 border border-white/5">
          <div>
            <p className="text-xs text-text-muted">Atas Nama</p>
            <p className="font-semibold text-text mt-0.5">{account.accountName}</p>
          </div>
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/20">
          <div>
            <p className="text-xs text-text-muted">Jumlah Transfer</p>
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

  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [paymentProofBase64, setPaymentProofBase64] = useState<string | null>(null);
  const [paymentProofName, setPaymentProofName] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError("Ukuran gambar maksimal 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setPaymentProofBase64(event.target?.result as string);
      setPaymentProofName(file.name);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  // Fetch order data via a lightweight API
  useEffect(() => {
    if (!orderId) return;

    async function loadOrder() {
      try {
        // Use the track endpoint to get order data
        const res = await fetch(`/api/orders/track?orderId=${orderId}`);
        if (res.ok) {
          const data = await res.json();
          setOrder(data.data);
        } else {
          setError("Order tidak ditemukan");
        }
      } catch {
        setError("Gagal memuat data order");
      } finally {
        setLoading(false);
      }
    }

    loadOrder();

    // Poll for status changes every 15 seconds
    const interval = setInterval(loadOrder, 15000);
    return () => clearInterval(interval);
  }, [orderId]);

  const handleConfirmTransfer = async () => {
    if (!order || confirming) return;

    setConfirming(true);
    setError(null);

    try {
      const res = await fetch(`/api/orders/${orderId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerName: order.customer_name,
          buyerDiscordId: order.buyer_discord_id || order.customer_discord,
          note: "",
          paymentProofBase64: paymentProofBase64 || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setConfirmed(true);
        // Update local state
        setOrder((prev) =>
          prev ? { ...prev, status: "WAITING_CONFIRMATION" } : prev
        );
      } else {
        setError(data.error?.message || "Gagal konfirmasi transfer");
      }
    } catch {
      setError("Terjadi kesalahan. Coba lagi.");
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/30 border-t-primary mx-auto" />
          <p className="text-text-muted text-sm">Memuat data pembayaran...</p>
        </div>
      </main>
    );
  }

  if (error && !order) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <XCircle className="h-12 w-12 text-red-400 mx-auto" />
          <h1 className="text-xl font-bold text-text">{error}</h1>
          <Link
            href="/products"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white"
          >
            Kembali ke Produk
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
          className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text mb-8 transition-colors group"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
          Kembali ke Produk
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl lg:text-3xl font-bold text-text mb-2">
            Instruksi Pembayaran
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-text-muted">Order:</span>
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
            "flex items-center gap-3 p-4 rounded-2xl border mb-8",
            isPaid
              ? "bg-emerald-500/10 border-emerald-500/20"
              : isTerminal
                ? "bg-red-500/10 border-red-500/20"
                : "bg-surface/40 border-white/5"
          )}
        >
          <StatusIcon className={cn("h-5 w-5", statusDisplay.color)} />
          <span className={cn("text-sm font-medium", statusDisplay.color)}>
            {statusDisplay.label}
          </span>
        </motion.div>

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
              className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15 mx-auto"
            >
              <CheckCircle2 className="h-10 w-10 text-emerald-400" />
            </motion.div>
            <h2 className="text-2xl font-bold text-text">
              Pembayaran Dikonfirmasi!
            </h2>
            <p className="text-text-muted">
              Pesanan Anda sedang diproses. Kami akan mengirim notifikasi ke
              Discord Anda.
            </p>
          </motion.div>
        )}

        {/* Terminal state (cancelled/expired) */}
        {isTerminal && (
          <div className="text-center py-12 space-y-4">
            <XCircle className="h-16 w-16 text-red-400 mx-auto" />
            <h2 className="text-xl font-bold text-text">
              Order {statusDisplay.label}
            </h2>
            <Link
              href="/products"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white"
            >
              Belanja Lagi
            </Link>
          </div>
        )}

        {/* Payment Instructions (only when payable or waiting) */}
        {(isPayable || isWaiting || confirmed) && (
          <div className="space-y-6">
            {/* Countdown Timer */}
            {isPayable && order.expiry_at && (
              <div className="text-center p-6 rounded-2xl bg-surface/40 border border-white/5">
                <p className="text-sm text-text-muted mb-2">
                  Batas Waktu Pembayaran
                </p>
                <CountdownTimer expiryAt={order.expiry_at} />
                <p className="text-xs text-text-muted/60 mt-2">
                  Selesaikan pembayaran sebelum waktu habis
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
                  Pilih Metode Pembayaran
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
                    Upload Bukti Pembayaran
                  </h3>
                  <label className="block w-full rounded-2xl border-2 border-dashed border-white/10 bg-surface/40 p-6 text-center cursor-pointer hover:border-primary/50 transition-colors">
                    <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                    {paymentProofBase64 ? (
                      <div className="space-y-2">
                        <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
                        <p className="text-sm font-medium text-emerald-400">{paymentProofName}</p>
                        <p className="text-xs text-text-muted">Klik untuk mengganti gambar</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <ImagePlus className="h-8 w-8 text-text-muted mx-auto" />
                        <p className="text-sm font-medium text-text">Pilih atau letakkan gambar disini</p>
                        <p className="text-xs text-text-muted">Maksimal 5MB (JPG, PNG)</p>
                      </div>
                    )}
                  </label>
                </div>

                {error && (
                  <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleConfirmTransfer}
                  disabled={confirming}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 rounded-2xl px-8 py-4 text-sm font-semibold transition-all duration-300 active:scale-[0.98]",
                    "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-400",
                    confirming && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {confirming ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Memproses...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-5 w-5" />
                      Saya Sudah Melakukan Transfer
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
                className="text-center p-6 rounded-2xl bg-blue-500/10 border border-blue-500/20 space-y-3"
              >
                <div className="h-10 w-10 animate-pulse rounded-full bg-blue-500/20 flex items-center justify-center mx-auto">
                  <Clock className="h-5 w-5 text-blue-400" />
                </div>
                <h3 className="font-semibold text-text">
                  Menunggu Verifikasi Admin
                </h3>
                <p className="text-sm text-text-muted">
                  Transfer Anda telah dikonfirmasi. Admin akan memverifikasi
                  pembayaran Anda. Anda akan menerima notifikasi melalui Discord.
                </p>
              </motion.div>
            )}
          </div>
        )}

        {/* Order Summary */}
        <div className="mt-8 p-5 rounded-2xl bg-surface/40 border border-white/5 space-y-3">
          <h3 className="text-sm font-semibold text-text">Ringkasan Order</h3>
          {order.order_item?.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-text-muted">
                {item.name} x{item.quantity}
              </span>
              <span className="text-text">
                {formatPrice(Number(item.price) * item.quantity)}
              </span>
            </div>
          ))}
          <div className="flex justify-between text-sm font-bold pt-2 border-t border-white/5">
            <span>Total</span>
            <span className="text-primary">{formatPrice(order.total)}</span>
          </div>
        </div>
      </div>
    </main>
  );
}
