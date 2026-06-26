"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle, XCircle } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

interface OrderItem {
  id: string; name: string; price: number; quantity: number; total: number;
}

interface Order {
  id: string; order_number: string; customer_name: string;
  customer_email: string | null; customer_discord: string | null;
  customer_ign: string | null; customer_notes: string | null;
  status: string; subtotal: number; tax: number; total: number;
  payment_method: string | null; payment_ref: string | null;
  currency: string; notes: string | null;
  created_at: string; updated_at: string;
  paid_at: string | null; completed_at: string | null;
  items: OrderItem[];
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  WAITING_PAYMENT: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  PAID: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  PROCESSING: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  COMPLETED: "bg-green-500/10 text-green-400 border-green-500/20",
  CANCELLED: "bg-red-500/10 text-red-400 border-red-500/20",
  REFUNDED: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

const TRANSITIONS: Record<string, { status: string; label: string; color: string }[]> = {
  PENDING: [
    { status: "WAITING_PAYMENT", label: "Menunggu Pembayaran", color: "orange" },
    { status: "CANCELLED", label: "Batalkan", color: "red" },
  ],
  WAITING_PAYMENT: [
    { status: "PAID", label: "Tandai Dibayar", color: "blue" },
    { status: "CANCELLED", label: "Batalkan", color: "red" },
  ],
  PAID: [
    { status: "PROCESSING", label: "Proses", color: "purple" },
    { status: "CANCELLED", label: "Batalkan", color: "red" },
  ],
  PROCESSING: [
    { status: "COMPLETED", label: "Selesai", color: "green" },
    { status: "CANCELLED", label: "Batalkan", color: "red" },
  ],
  COMPLETED: [], CANCELLED: [], REFUNDED: [],
};

function fmtIDR(n: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
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
    setUpdating(true);
    try {
      const payload: any = { status: newStatus, updated_at: new Date().toISOString() };
      if (newStatus === "PAID") payload.paid_at = new Date().toISOString();
      if (newStatus === "COMPLETED") payload.completed_at = new Date().toISOString();
      const { error: upErr } = await supabase.from("order").update(payload).eq("id", order.id);
      if (upErr) throw upErr;
      setOkMsg(`Status → ${newStatus.replace("_", " ")}`);
      setTimeout(() => setOkMsg(""), 3000);
      fetchOrder();
    } catch (e: any) { setError(e.message || "Gagal update"); }
    finally { setUpdating(false); }
  }, [order, supabase, fetchOrder]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="flex items-center gap-2 text-gray-400"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500" /> Memuat...</div></div>;
  }

  if (error || !order) {
    return (
      <div className="space-y-4">
        <Link href="/admin/orders" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white"><ArrowLeft className="h-4 w-4" /> Kembali</Link>
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">{error || "Tidak ditemukan"}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/admin/orders" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white"><ArrowLeft className="h-4 w-4" /> Kembali</Link>
      {okMsg && <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg text-sm flex items-center gap-2 animate-fade-in"><CheckCircle className="h-4 w-4" />{okMsg}</div>}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">#{order.order_number}</h1>
          <p className="text-gray-400 text-sm mt-1">{fmtDate(order.created_at)}</p>
        </div>
        <span className={`inline-flex px-3 py-1.5 rounded-full text-sm font-medium border self-start ${STATUS_STYLES[order.status]}`}>{order.status.replace("_", " ")}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-medium text-gray-300 mb-3">Pelanggan</h3>
          <div className="space-y-2 text-sm">
            <div><span className="text-gray-500">Nama:</span><p className="text-white">{order.customer_name}</p></div>
            {order.customer_email && <div><span className="text-gray-500">Email:</span><p className="text-white">{order.customer_email}</p></div>}
            {order.customer_discord && <div><span className="text-gray-500">Discord:</span><p className="text-white">{order.customer_discord}</p></div>}
            {order.customer_ign && <div><span className="text-gray-500">IGN:</span><p className="text-white">{order.customer_ign}</p></div>}
          </div>
        </div>
        <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-medium text-gray-300 mb-3">Pembayaran</h3>
          <div className="space-y-2 text-sm">
            <div><span className="text-gray-500">Metode:</span><p className="text-white capitalize">{order.payment_method || "-"}</p></div>
            {order.payment_ref && <div><span className="text-gray-500">Ref:</span><p className="text-white font-mono text-xs">{order.payment_ref}</p></div>}
            {order.paid_at && <div><span className="text-gray-500">Dibayar:</span><p className="text-white">{fmtDate(order.paid_at)}</p></div>}
            {order.completed_at && <div><span className="text-gray-500">Selesai:</span><p className="text-white">{fmtDate(order.completed_at)}</p></div>}
          </div>
        </div>
        <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-medium text-gray-300 mb-3">Riwayat</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-green-400"><CheckCircle className="h-3.5 w-3.5" /> Dibuat ({fmtDate(order.created_at)})</div>
            {order.paid_at && <div className="flex items-center gap-2 text-blue-400"><CheckCircle className="h-3.5 w-3.5" /> Dibayar</div>}
            {order.completed_at && <div className="flex items-center gap-2 text-green-400"><CheckCircle className="h-3.5 w-3.5" /> Selesai</div>}
            {order.status === "CANCELLED" && <div className="flex items-center gap-2 text-red-400"><XCircle className="h-3.5 w-3.5" /> Dibatalkan</div>}
          </div>
        </div>
      </div>

      <div className="bg-gray-900/80 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800"><h3 className="text-sm font-medium text-gray-300">Item</h3></div>
        <div className="divide-y divide-gray-800/50">
          {order.items?.map(item => (
            <div key={item.id} className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-3">
                <span className="text-gray-500 text-xs font-mono bg-gray-800 px-2 py-0.5 rounded">x{item.quantity}</span>
                <span className="text-white text-sm">{item.name}</span>
              </div>
              <span className="text-white text-sm font-medium">{fmtIDR(item.total)}</span>
            </div>
          ))}
        </div>
        <div className="px-5 py-4 bg-gray-800/30 border-t border-gray-800">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-400">Subtotal</span><span className="text-gray-300">{fmtIDR(order.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Pajak</span><span className="text-gray-300">{fmtIDR(order.tax)}</span></div>
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-700">
              <span className="text-white">Total</span><span className="text-white">{fmtIDR(order.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {order.customer_notes && (
        <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-medium text-gray-300 mb-2">Catatan</h3>
          <p className="text-sm text-gray-400">{order.customer_notes}</p>
        </div>
      )}

      {(TRANSITIONS[order.status]?.length || 0) > 0 && (
        <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-medium text-gray-300 mb-3">Perbarui Status</h3>
          <div className="flex flex-wrap gap-2">
            {(TRANSITIONS[order.status] || []).map(a => (
              <button key={a.status} onClick={() => updateStatus(a.status)} disabled={updating}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
                  a.color === "green" ? "bg-green-600 hover:bg-green-500 text-white" :
                  a.color === "blue" ? "bg-blue-600 hover:bg-blue-500 text-white" :
                  a.color === "purple" ? "bg-purple-600 hover:bg-purple-500 text-white" :
                  a.color === "orange" ? "bg-orange-600 hover:bg-orange-500 text-white" :
                  "bg-red-600 hover:bg-red-500 text-white"}`}>
                {updating ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> :
                  a.color === "red" ? <XCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
