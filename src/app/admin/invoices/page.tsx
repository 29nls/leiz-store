"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  FileText, X, AlertTriangle, ChevronLeft, ChevronRight,
  Eye, Send, CheckCircle, ExternalLink,
} from "lucide-react";
import { getSupabaseBrowser, subscribeToTable } from "@/lib/supabase-browser";

interface Invoice {
  id: string; order_id: string; invoice_no: string; status: string;
  sent_via_email: boolean; sent_via_wa: boolean;
  email_status: string; wa_status: string;
  pdf_url: string | null; error_log: string | null;
  created_at: string; sent_at: string | null;
  order?: { order_number: string; customer_name: string; customer_email: string; total: number; currency: string } | null;
}

const STATUSES = ["ALL", "PENDING", "SENT", "FAILED"];

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  SENT: "bg-green-500/10 text-green-400 border-green-500/20",
  FAILED: "bg-red-500/10 text-red-400 border-red-500/20",
};

function fmtIDR(n: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}
function fmtDate(s: string): string {
  return new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AdminInvoicesPage() {
  const supabase = getSupabaseBrowser();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [resending, setResending] = useState(false);
  const [okMsg, setOkMsg] = useState("");
  const okTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showOk = useCallback((m: string) => { setOkMsg(m); if (okTimer.current) clearTimeout(okTimer.current); okTimer.current = setTimeout(() => setOkMsg(""), 3000); }, []);

  const fetchInvoices = useCallback(async () => {
    setLoading(true); setError("");
    try {
      let q = supabase.from("invoice").select("*, order:order(order_number, customer_name, customer_email, total, currency)", { count: "exact" });
      if (statusFilter !== "ALL") q = q.eq("status", statusFilter);
      const from = (page - 1) * limit;
      const { data, error: err, count } = await q.order("created_at", { ascending: false }).range(from, from + limit - 1);
      if (err) throw err;
      setInvoices((data || []) as any);
      setTotalPages(Math.ceil((count || 0) / limit) || 1);
      setTotal(count || 0);
    } catch (e: any) { setError(e.message || "Gagal memuat"); }
    finally { setLoading(false); }
  }, [statusFilter, page, supabase]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);
  useEffect(() => {
    const unsub = subscribeToTable("invoice", () => fetchInvoices());
    return unsub;
  }, [fetchInvoices]);
  useEffect(() => { setPage(1); }, [statusFilter]);

  const handleResend = useCallback(async (invoiceId: string) => {
    setResending(true); setError("");
    try {
      const res = await fetch("/api/admin/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId, action: "resend" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Gagal resend");
      showOk("Resend dikirimkan ke antrian");
      setSelected(p => p ? { ...p, status: "PENDING" } : null);
      fetchInvoices();
    } catch (e: any) { setError(e.message || "Gagal resend"); }
    finally { setResending(false); }
  }, [fetchInvoices, showOk]);

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-white">Invoice</h1><p className="text-gray-400 text-sm mt-1">Kelola invoice pelanggan</p></div>
      {okMsg && <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg text-sm flex items-center gap-2 animate-fade-in"><CheckCircle className="h-4 w-4" />{okMsg}</div>}
      {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{error}<button onClick={() => setError("")} className="ml-auto"><X className="h-4 w-4" /></button></div>}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUSES.map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${statusFilter === s ? "bg-blue-600 text-white" : "bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-800"}`}>
            {s === "ALL" ? "Semua" : s}
          </button>
        ))}
      </div>

      <div className="bg-gray-900/80 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/50">
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Invoice</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Pesanan</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Pelanggan</th>
                <th className="text-center py-3 px-4 text-gray-400 font-medium">Status</th>
                <th className="text-center py-3 px-4 text-gray-400 font-medium">Email</th>
                <th className="text-center py-3 px-4 text-gray-400 font-medium">WA</th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">Waktu</th>
                <th className="text-center py-3 px-4 text-gray-400 font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {loading ? (
                <tr><td colSpan={8} className="py-12 text-center"><div className="flex items-center justify-center gap-2 text-gray-400"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500" /> Memuat...</div></td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center"><div className="flex flex-col items-center gap-2 text-gray-500"><FileText className="h-10 w-10 opacity-30" /><p>Tidak ada invoice</p></div></td></tr>
              ) : invoices.map(inv => (
                <tr key={inv.id} className="hover:bg-gray-800/30 transition-colors cursor-pointer" onClick={() => setSelected(inv)}>
                  <td className="py-3 px-4"><span className="text-white font-medium font-mono text-xs">{inv.invoice_no}</span></td>
                  <td className="py-3 px-4"><span className="text-gray-400 font-mono text-xs">{inv.order?.order_number || inv.order_id.slice(0, 8)}</span></td>
                  <td className="py-3 px-4"><p className="text-white">{inv.order?.customer_name || "-"}</p></td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_STYLES[inv.status] || "bg-gray-500/10 text-gray-400"}`}>{inv.status}</span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {inv.sent_via_email ? <span className="text-green-400 text-xs">&#10003;</span> :
                     inv.email_status === "FAILED" ? <span className="text-red-400 text-xs">&#10007;</span> :
                     <span className="text-gray-500 text-xs">-</span>}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {inv.sent_via_wa ? <span className="text-green-400 text-xs">&#10003;</span> :
                     inv.wa_status === "FAILED" ? <span className="text-red-400 text-xs">&#10007;</span> :
                     <span className="text-gray-500 text-xs">-</span>}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-400 text-xs">{fmtDate(inv.created_at)}</td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={e => { e.stopPropagation(); setSelected(inv); }} className="p-2 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg"><Eye className="h-4 w-4" /></button>
                      {inv.status === "FAILED" && (
                        <button onClick={e => { e.stopPropagation(); handleResend(inv.id); }} disabled={resending}
                          className="p-2 text-gray-400 hover:text-purple-400 hover:bg-purple-500/10 rounded-lg disabled:opacity-30">
                          <Send className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
            <p className="text-sm text-gray-400">{total} invoice</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="p-2 text-gray-400 hover:text-white disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
              <span className="text-sm text-gray-400 px-2">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-2 text-gray-400 hover:text-white disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-2xl bg-gray-900 border border-gray-800 rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-semibold text-white">{selected.invoice_no}</h2>
              <button onClick={() => setSelected(null)} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-3">
                <span className={`inline-flex px-3 py-1.5 rounded-full text-sm font-medium border ${STATUS_STYLES[selected.status]}`}>{selected.status}</span>
                <span className="text-xs text-gray-500">{fmtDate(selected.created_at)}</span>
              </div>

              <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-300 mb-2">Informasi</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-500">Invoice:</span><p className="text-white font-mono">{selected.invoice_no}</p></div>
                  <div><span className="text-gray-500">Order:</span><p className="text-white font-mono">{selected.order?.order_number || selected.order_id}</p></div>
                  <div><span className="text-gray-500">Pelanggan:</span><p className="text-white">{selected.order?.customer_name || "-"}</p></div>
                  <div><span className="text-gray-500">Email:</span><p className="text-white">{selected.order?.customer_email || "-"}</p></div>
                  {selected.order?.total && <div><span className="text-gray-500">Total:</span><p className="text-white font-medium">{fmtIDR(selected.order.total)}</p></div>}
                </div>
              </div>

              <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-300 mb-2">Status Pengiriman</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Email</span>
                    <span className={`font-medium ${selected.email_status === "SUCCESS" ? "text-green-400" : selected.email_status === "FAILED" ? "text-red-400" : "text-yellow-400"}`}>
                      {selected.email_status || "PENDING"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">WhatsApp</span>
                    <span className={`font-medium ${selected.wa_status === "SUCCESS" ? "text-green-400" : selected.wa_status === "FAILED" ? "text-red-400" : "text-yellow-400"}`}>
                      {selected.wa_status || "PENDING"}
                    </span>
                  </div>
                </div>
              </div>

              {selected.error_log && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-red-400 mb-2">Error Log</h3>
                  <pre className="text-xs text-red-300 whitespace-pre-wrap">{selected.error_log}</pre>
                </div>
              )}

              {selected.sent_at && (
                <p className="text-xs text-gray-500">Terkirim: {fmtDate(selected.sent_at)}</p>
              )}

              {selected.status === "FAILED" && (
                <div className="border-t border-gray-800 pt-4">
                  <button onClick={() => handleResend(selected.id)} disabled={resending}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
                    {resending ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Send className="h-4 w-4" />}
                    Kirim Ulang Invoice
                  </button>
                </div>
              )}

              {selected.pdf_url && (
                <div className="border-t border-gray-800 pt-4">
                  <a href={selected.pdf_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-medium transition-colors">
                    <ExternalLink className="h-4 w-4" />
                    Lihat PDF
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
