"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Search, ShoppingCart, X, AlertTriangle, ChevronLeft, ChevronRight,
  Eye, CheckCircle, XCircle,
} from "lucide-react";
import { getSupabaseBrowser, subscribeToTable } from "@/lib/supabase-browser";

interface OrderItem {
  id: string; name: string; price: number; quantity: number; total: number;
}

interface Order {
  id: string; order_number: string; customer_name: string;
  customer_email: string | null; customer_discord: string | null;
  status: string; total: number; payment_method: string | null;
  created_at: string; items: OrderItem[];
}

const STATUSES = ["ALL", "PENDING", "WAITING_PAYMENT", "PAID", "PROCESSING", "COMPLETED", "CANCELLED", "REFUNDED"];

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  WAITING_PAYMENT: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  PAID: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  PROCESSING: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  COMPLETED: "bg-green-500/10 text-green-400 border-green-500/20",
  CANCELLED: "bg-red-500/10 text-red-400 border-red-500/20",
  REFUNDED: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

const STATUS_TRANSITIONS: Record<string, { status: string; label: string; color: string }[]> = {
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
  return new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function relTime(s: string): string {
  const d = Date.now() - new Date(s).getTime();
  const m = Math.floor(d / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}j`;
  return `${Math.floor(h / 24)}h`;
}

export default function AdminOrdersPage() {
  const supabase = getSupabaseBrowser();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [searchDb, setSearchDb] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;
  const [selected, setSelected] = useState<Order | null>(null);
  const [updating, setUpdating] = useState(false);
  const [okMsg, setOkMsg] = useState("");
  const okTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showOk = useCallback((m: string) => { setOkMsg(m); if (okTimer.current) clearTimeout(okTimer.current); okTimer.current = setTimeout(() => setOkMsg(""), 3000); }, []);

  const fetchOrders = useCallback(async () => {
    setLoading(true); setError("");
    try {
      let q = supabase.from("order").select("*, items:order_item(*)", { count: "exact" });
      if (searchDb) q = q.or(`order_number.ilike.%${searchDb}%,customer_name.ilike.%${searchDb}%`);
      if (statusFilter !== "ALL") q = q.eq("status", statusFilter);
      const from = (page - 1) * limit;
      const { data, error: err, count } = await q.order("created_at", { ascending: false }).range(from, from + limit - 1);
      if (err) throw err;
      setOrders((data || []) as any);
      setTotalPages(Math.ceil((count || 0) / limit) || 1);
      setTotal(count || 0);
    } catch (e: any) { setError(e.message || "Gagal memuat"); }
    finally { setLoading(false); }
  }, [searchDb, statusFilter, page, supabase]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  useEffect(() => {
    const unsub = subscribeToTable("order", () => fetchOrders());
    return unsub;
  }, [fetchOrders]);
  useEffect(() => { const t = setTimeout(() => setSearchDb(search), 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(1); }, [searchDb, statusFilter]);

  const updateStatus = useCallback(async (orderId: string, newStatus: string) => {
    setUpdating(true);
    try {
      const payload: any = { status: newStatus, updated_at: new Date().toISOString() };
      if (newStatus === "PAID" || newStatus === "paid") payload.paid_at = new Date().toISOString();
      if (newStatus === "COMPLETED" || newStatus === "completed") payload.completed_at = new Date().toISOString();
      const { error: upErr } = await supabase.from("order").update(payload).eq("id", orderId);
      if (upErr) throw upErr;
      showOk(`Status → ${newStatus.replace("_", " ")}`);
      setSelected(p => p ? { ...p, status: newStatus } : null);
      fetchOrders();
    } catch (e: any) { setError(e.message || "Gagal update"); }
    finally { setUpdating(false); }
  }, [supabase, fetchOrders, showOk]);

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-white">Pesanan</h1><p className="text-gray-400 text-sm mt-1">Kelola semua pesanan pelanggan</p></div>
      {okMsg && <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg text-sm flex items-center gap-2 animate-fade-in"><CheckCircle className="h-4 w-4" />{okMsg}</div>}
      {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{error}<button onClick={() => setError("")} className="ml-auto"><X className="h-4 w-4" /></button></div>}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari pesanan..." className="w-full pl-10 pr-4 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {STATUSES.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${statusFilter === s ? "bg-blue-600 text-white" : "bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-800"}`}>
              {s === "ALL" ? "Semua" : s.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-gray-900/80 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/50">
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Pesanan</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Pelanggan</th>
                <th className="text-center py-3 px-4 text-gray-400 font-medium">Status</th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">Total</th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">Waktu</th>
                <th className="text-center py-3 px-4 text-gray-400 font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {loading ? (
                <tr><td colSpan={6} className="py-12 text-center"><div className="flex items-center justify-center gap-2 text-gray-400"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500" /> Memuat...</div></td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center"><div className="flex flex-col items-center gap-2 text-gray-500"><ShoppingCart className="h-10 w-10 opacity-30" /><p>Tidak ada pesanan</p></div></td></tr>
              ) : orders.map(o => (
                <tr key={o.id} className="hover:bg-gray-800/30 transition-colors cursor-pointer" onClick={() => setSelected(o)}>
                  <td className="py-3 px-4"><span className="text-white font-medium font-mono text-xs">#{o.order_number}</span></td>
                  <td className="py-3 px-4"><p className="text-white font-medium">{o.customer_name}</p>{o.customer_email && <p className="text-xs text-gray-500">{o.customer_email}</p>}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_STYLES[o.status] || "bg-gray-500/10 text-gray-400"}`}>{o.status.replace("_", " ")}</span>
                  </td>
                  <td className="py-3 px-4 text-right text-white font-medium">{fmtIDR(o.total)}</td>
                  <td className="py-3 px-4 text-right text-gray-400 text-xs"><p>{fmtDate(o.created_at)}</p><p className="text-gray-500">{relTime(o.created_at)} lalu</p></td>
                  <td className="py-3 px-4 text-center">
                    <button onClick={e => { e.stopPropagation(); setSelected(o); }} className="p-2 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg"><Eye className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
            <p className="text-sm text-gray-400">{total} pesanan</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="p-2 text-gray-400 hover:text-white disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
              <span className="text-sm text-gray-400 px-2">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-2 text-gray-400 hover:text-white disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-2xl bg-gray-900 border border-gray-800 rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-semibold text-white">#{selected.order_number}</h2>
              <button onClick={() => setSelected(null)} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-3">
                <span className={`inline-flex px-3 py-1.5 rounded-full text-sm font-medium border ${STATUS_STYLES[selected.status]}`}>{selected.status.replace("_", " ")}</span>
                <span className="text-xs text-gray-500">{fmtDate(selected.created_at)}</span>
              </div>
              <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-300 mb-2">Pelanggan</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-500">Nama:</span><p className="text-white">{selected.customer_name}</p></div>
                  {selected.customer_email && <div><span className="text-gray-500">Email:</span><p className="text-white">{selected.customer_email}</p></div>}
                  {selected.customer_discord && <div><span className="text-gray-500">Discord:</span><p className="text-white">{selected.customer_discord}</p></div>}
                  {selected.payment_method && <div><span className="text-gray-500">Pembayaran:</span><p className="text-white capitalize">{selected.payment_method}</p></div>}
                </div>
              </div>
              <div><h3 className="text-sm font-medium text-gray-300 mb-3">Item</h3>
                <div className="space-y-2">
                  {selected.items?.map(item => (
                    <div key={item.id} className="flex items-center justify-between bg-gray-800/30 border border-gray-700/30 rounded-lg px-4 py-3">
                      <div className="flex items-center gap-3"><span className="text-gray-500 text-xs font-mono bg-gray-800 px-2 py-0.5 rounded">x{item.quantity}</span><span className="text-white text-sm">{item.name}</span></div>
                      <span className="text-white text-sm font-medium">{fmtIDR(item.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end border-t border-gray-800 pt-4">
                <div className="text-right"><p className="text-sm text-gray-400">Total</p><p className="text-2xl font-bold text-white">{fmtIDR(selected.total)}</p></div>
              </div>
              {(STATUS_TRANSITIONS[selected.status]?.length || 0) > 0 && (
                <div className="border-t border-gray-800 pt-4">
                  <h3 className="text-sm font-medium text-gray-300 mb-3">Perbarui Status</h3>
                  <div className="flex flex-wrap gap-2">
                    {(STATUS_TRANSITIONS[selected.status] || []).map(a => (
                      <button key={a.status} onClick={() => updateStatus(selected.id, a.status)} disabled={updating}
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
          </div>
        </div>
      )}
    </div>
  );
}
