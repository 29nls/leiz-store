"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle, XCircle } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { getStatusBadge } from "@/lib/status-colors";

interface OrderItem {
  id: string; name: string; price: number; quantity: number; total: number;
}

interface Order {
  id: string; order_number: string; customer_name: string;
  customer_discord: string | null;
  customer_ign: string | null; customer_notes: string | null;
  status: string; subtotal: number; tax: number; total: number;
  payment_method: string | null; payment_ref: string | null;
  currency: string; notes: string | null;
  created_at: string; updated_at: string;
  paid_at: string | null; completed_at: string | null;
  items: OrderItem[];
}

const TRANSITIONS: Record<string, { status: string; label: string; color: string }[]> = {
  PENDING: [
    { status: "PENDING_PAYMENT", label: "Menunggu Pembayaran", color: "orange" },
    { status: "CANCELLED", label: "Batalkan", color: "red" },
  ],
  PENDING_PAYMENT: [
    { status: "WAITING_CONFIRMATION", label: "Tandai Dikonfirmasi", color: "blue" },
    { status: "CANCELLED", label: "Batalkan", color: "red" },
  ],
  WAITING_PAYMENT: [
    { status: "PAID", label: "Tandai Dibayar", color: "blue" },
    { status: "CANCELLED", label: "Batalkan", color: "red" },
  ],
  WAITING_CONFIRMATION: [
    { status: "PAID", label: "Terima Pembayaran", color: "blue" },
    { status: "REJECTED", label: "Tolak", color: "red" },
  ],
  PAID: [
    { status: "PROCESSING", label: "Proses", color: "purple" },
    { status: "CANCELLED", label: "Batalkan", color: "red" },
  ],
  PROCESSING: [
    { status: "COMPLETED", label: "Selesai", color: "green" },
    { status: "CANCELLED", label: "Batalkan", color: "red" },
  ],
  COMPLETED: [], CANCELLED: [], REJECTED: [], REFUNDED: [], NEEDS_REVIEW: [],
};

function fmtIDR(n: number | null | undefined): string {
  const num = Number(n ?? 0);
  if (isNaN(num)) return "Rp0";
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(num);
}

function fmtDate(s: string): string {
  return new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function OrderDetailPage() {
  const supabase = getSupabaseBrowser();
  const params = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);
  const [okMsg, setOkMsg] = useState("");

  const fetchOrder = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const { data, error: err } = await supabase
        .from("order")
        .select("*, items:order_item(*)")
        .eq("id", params.id)
        .single();
      if (err) throw err;
      setOrder(data as any);
    } catch (e: any) { setError(e.message || "Gagal memuat"); }
    finally { setLoading(false); }
  }, [params.id, supabase]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  const updateStatus = useCallback(async (newStatus: string) => {
    if (!order) return;
    setUpdating(true); setError("");
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Gagal update (${res.status})`);
      }

      setOkMsg(`Status → ${newStatus.replace("_", " ")}`);
      setTimeout(() => setOkMsg(""), 3000);
      fetchOrder();
    } catch (e: any) {
      setError(e.message || "Gagal update");
    } finally {
      setUpdating(false);
    }
  }, [order, fetchOrder]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="flex items-center gap-2 text-text-secondary"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-arcane" /> Memuat...</div></div>;
  }

  if (error || !order) {
    return (
      <div className="space-y-4">
        <Link href="/admin/orders" className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary"><ArrowLeft className="h-4 w-4" /> Kembali</Link>
        <div className="bg-error/10 border border-error/20 text-error px-4 py-3 rounded-lg text-sm">{error || "Tidak ditemukan"}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/admin/orders" className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary"><ArrowLeft className="h-4 w-4" /> Kembali</Link>
      {okMsg && <div className="bg-success/10 border border-success/20 text-success px-4 py-3 rounded-lg text-sm flex items-center gap-2 animate-fade-in"><CheckCircle className="h-4 w-4" />{okMsg}</div>}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">#{order.order_number}</h1>
          <p className="text-text-secondary text-sm mt-1">{fmtDate(order.created_at)}</p>
        </div>
        <span className={`inline-flex px-3 py-1.5 rounded-full text-sm font-medium border self-start ${getStatusBadge(order.status)}`}>{order.status.replace("_", " ")}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-surface border border-border rounded-xl p-5">
          <h3 className="text-sm font-medium text-text-primary mb-3">Pelanggan</h3>
          <div className="space-y-2 text-sm">
            <div><span className="text-text-tertiary">Nama:</span><p className="text-white">{order.customer_name}</p></div>
            {order.customer_discord && <div><span className="text-text-tertiary">Discord:</span><p className="text-white">{order.customer_discord}</p></div>}
            {order.customer_ign && <div><span className="text-text-tertiary">IGN:</span><p className="text-white">{order.customer_ign}</p></div>}
          </div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-5">
          <h3 className="text-sm font-medium text-text-primary mb-3">Pembayaran</h3>
          <div className="space-y-2 text-sm">
            <div><span className="text-text-tertiary">Metode:</span><p className="text-white capitalize">{order.payment_method || "-"}</p></div>
            {order.payment_ref && <div><span className="text-text-tertiary">Ref:</span><p className="text-white font-mono text-xs">{order.payment_ref}</p></div>}
            {order.paid_at && <div><span className="text-text-tertiary">Dibayar:</span><p className="text-white">{fmtDate(order.paid_at)}</p></div>}
            {order.completed_at && <div><span className="text-text-tertiary">Selesai:</span><p className="text-white">{fmtDate(order.completed_at)}</p></div>}
          </div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-5">
          <h3 className="text-sm font-medium text-text-primary mb-3">Riwayat</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-success"><CheckCircle className="h-3.5 w-3.5" /> Dibuat ({fmtDate(order.created_at)})</div>
            {order.paid_at && <div className="flex items-center gap-2 text-arcane"><CheckCircle className="h-3.5 w-3.5" /> Dibayar</div>}
            {order.completed_at && <div className="flex items-center gap-2 text-success"><CheckCircle className="h-3.5 w-3.5" /> Selesai</div>}
            {order.status === "CANCELLED" && <div className="flex items-center gap-2 text-error"><XCircle className="h-3.5 w-3.5" /> Dibatalkan</div>}
          </div>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border"><h3 className="text-sm font-medium text-text-primary">Item</h3></div>
        <div className="divide-y divide-border">
          {order.items?.map(item => (
            <div key={item.id} className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-3">
                <span className="text-text-tertiary text-xs font-mono bg-surface-raised px-2 py-0.5 rounded">x{item.quantity}</span>
                <span className="text-white text-sm">{item.name}</span>
              </div>
              <span className="text-white text-sm font-medium">{fmtIDR(item.total)}</span>
            </div>
          ))}
        </div>
        <div className="px-5 py-4 bg-surface-raised border-t border-border">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-text-secondary">Subtotal</span><span className="text-text-primary">{fmtIDR(order.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-text-secondary">Pajak</span><span className="text-text-primary">{fmtIDR(order.tax)}</span></div>
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-border">
              <span className="text-white">Total</span><span className="text-white">{fmtIDR(order.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {order.customer_notes && (
        <div className="bg-surface border border-border rounded-xl p-5">
          <h3 className="text-sm font-medium text-text-primary mb-2">Catatan</h3>
          <p className="text-sm text-text-secondary">{order.customer_notes}</p>
        </div>
      )}

      {(TRANSITIONS[order.status]?.length || 0) > 0 && (
        <div className="bg-surface border border-border rounded-xl p-5">
          <h3 className="text-sm font-medium text-text-primary mb-3">Perbarui Status</h3>
          <div className="flex flex-wrap gap-2">
            {(TRANSITIONS[order.status] || []).map(a => (
              <button key={a.status} onClick={() => updateStatus(a.status)} disabled={updating}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
                  a.color === "green" ? "bg-success hover:bg-success/80 text-white" :
                  a.color === "blue" ? "bg-arcane hover:bg-arcane/80 text-white" :
                  a.color === "purple" ? "bg-arcane hover:bg-arcane/80 text-white" :
                  a.color === "orange" ? "bg-ember hover:bg-ember-bright text-white" :
                  "bg-error hover:bg-error/80 text-white"
                }`}
              >
                {a.color === "red" ? <XCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
