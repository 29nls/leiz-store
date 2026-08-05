"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  FileText, X, AlertTriangle, ChevronLeft, ChevronRight,
  Eye, Send, CheckCircle, ExternalLink,
} from "lucide-react";
import { getSupabaseBrowser, subscribeToTable } from "@/lib/supabase-browser";
import { getInvoiceStatusBadge } from "@/lib/status-colors";
import { InvoiceEmailStatus } from "@/lib/invoice/types";

interface Invoice {
  id: string; order_id: string; invoice_no: string; status: string;
  pdf_url: string | null; pdf_path?: string | null; error_log: string | null;
  email_status: string | null;
  created_at: string; sent_at: string | null;
  order?: { order_number: string; customer_name: string; total: number; currency: string } | null;
}

// Email delivery sub-state that warrants offering a resend: the PDF exists but
// the email was skipped (no recipient / SMTP unconfigured) or failed.
function needsResend(inv: Invoice): boolean {
  return inv.status === "FAILED"
    || inv.email_status === InvoiceEmailStatus.FAILED
    || inv.email_status === InvoiceEmailStatus.SKIPPED;
}

function EmailStatusChip({ status }: { status: string | null }) {
  if (status === InvoiceEmailStatus.SENT) {
    return <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border border-success/30 text-success ml-1">Email ✓</span>;
  }
  if (status === InvoiceEmailStatus.FAILED) {
    return <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border border-error/30 text-error ml-1">Email ✗</span>;
  }
  if (status === InvoiceEmailStatus.SKIPPED) {
    return <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border border-warning/30 text-warning ml-1">Email lewati</span>;
  }
  return null;
}

const STATUSES = ["ALL", "PENDING", "SENT", "FAILED"];

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
      let q = supabase.from("invoice").select("*, order:order(order_number, customer_name, total, currency)", { count: "exact" });
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
      showOk("Invoice akan dibuat ulang");
      setSelected(p => p ? { ...p, status: "PENDING" } : null);
      fetchInvoices();
    } catch (e: any) { setError(e.message || "Gagal resend"); }
    finally { setResending(false); }
  }, [fetchInvoices, showOk]);

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-white">Invoice</h1><p className="text-text-secondary text-sm mt-1">Kelola invoice pelanggan</p></div>
      {okMsg && <div className="bg-success/10 border border-success/20 text-success px-4 py-3 rounded-lg text-sm flex items-center gap-2 animate-fade-in"><CheckCircle className="h-4 w-4" />{okMsg}</div>}
      {error && <div className="bg-error/10 border border-error/20 text-error px-4 py-3 rounded-lg text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{error}<button onClick={() => setError("")} className="ml-auto"><X className="h-4 w-4" /></button></div>}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUSES.map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${statusFilter === s ? "bg-arcane text-white" : "bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-raised border border-border"}`}>
            {s === "ALL" ? "Semua" : s}
          </button>
        ))}
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-raised">
                <th className="text-left py-3 px-4 text-text-secondary font-medium">Invoice</th>
                <th className="text-left py-3 px-4 text-text-secondary font-medium">Pesanan</th>
                <th className="text-left py-3 px-4 text-text-secondary font-medium">Pelanggan</th>
                <th className="text-center py-3 px-4 text-text-secondary font-medium">Status</th>
                <th className="text-right py-3 px-4 text-text-secondary font-medium">Waktu</th>
                <th className="text-center py-3 px-4 text-text-secondary font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={6} className="py-12 text-center"><div className="flex items-center justify-center gap-2 text-text-secondary"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-arcane" /> Memuat...</div></td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center"><div className="flex flex-col items-center gap-2 text-text-tertiary"><FileText className="h-10 w-10 opacity-30" /><p>Tidak ada invoice</p></div></td></tr>
              ) : invoices.map(inv => (
                <tr key={inv.id} className="hover:bg-surface-raised transition-colors cursor-pointer" onClick={() => setSelected(inv)}>
                  <td className="py-3 px-4"><span className="text-white font-medium font-mono text-xs">{inv.invoice_no}</span></td>
                  <td className="py-3 px-4"><span className="text-text-secondary font-mono text-xs">{inv.order?.order_number || inv.order_id.slice(0, 8)}</span></td>
                  <td className="py-3 px-4"><p className="text-white">{inv.order?.customer_name || "-"}</p></td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium border ${getInvoiceStatusBadge(inv.status)}`}>{inv.status}</span>
                      <EmailStatusChip status={inv.email_status} />
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-text-secondary text-xs">{fmtDate(inv.created_at)}</td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={e => { e.stopPropagation(); setSelected(inv); }} className="p-2 text-text-secondary hover:text-arcane hover:bg-arcane/10 rounded-lg"><Eye className="h-4 w-4" /></button>
                      {needsResend(inv) && (
                        <button onClick={e => { e.stopPropagation(); handleResend(inv.id); }} disabled={resending}
                          className="p-2 text-text-secondary hover:text-arcane hover:bg-arcane/10 rounded-lg disabled:opacity-30"
                          title="Buat ulang & kirim ulang invoice">
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
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-sm text-text-secondary">{total} invoice</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="p-2 text-text-secondary hover:text-text-primary disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
              <span className="text-sm text-text-secondary px-2">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-2 text-text-secondary hover:text-text-primary disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-2xl bg-surface border border-border rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-surface border-b border-border px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-semibold text-white">{selected.invoice_no}</h2>
              <button onClick={() => setSelected(null)} className="p-2 text-text-secondary hover:text-text-primary hover:bg-surface-raised rounded-lg"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-3">
                <span className={`inline-flex px-3 py-1.5 rounded-full text-sm font-medium border ${getInvoiceStatusBadge(selected.status)}`}>{selected.status}</span>
                <EmailStatusChip status={selected.email_status} />
                <span className="text-xs text-text-tertiary">{fmtDate(selected.created_at)}</span>
              </div>

              <div className="bg-surface-raised border border-border rounded-lg p-4">
                <h3 className="text-sm font-medium text-text-primary mb-2">Informasi</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-text-tertiary">Invoice:</span><p className="text-white font-mono">{selected.invoice_no}</p></div>
                  <div><span className="text-text-tertiary">Order:</span><p className="text-white font-mono">{selected.order?.order_number || selected.order_id}</p></div>
                  <div><span className="text-text-tertiary">Pelanggan:</span><p className="text-white">{selected.order?.customer_name || "-"}</p></div>
                  {selected.order?.total && <div><span className="text-text-tertiary">Total:</span><p className="text-white font-medium">{fmtIDR(selected.order.total)}</p></div>}
                </div>
              </div>

              {selected.error_log && (
                <div className="bg-error/10 border border-error/20 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-error mb-2">Error Log</h3>
                  <pre className="text-xs text-red-300 whitespace-pre-wrap">{selected.error_log}</pre>
                </div>
              )}

              {selected.sent_at && (
                <p className="text-xs text-text-tertiary">Terkirim: {fmtDate(selected.sent_at)}</p>
              )}

              {needsResend(selected) && (
                <div className="border-t border-border pt-4">
                  <button onClick={() => handleResend(selected.id)} disabled={resending}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-arcane hover:bg-arcane/80 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
                    {resending ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Send className="h-4 w-4" />}
                    Buat Ulang & Kirim Ulang Invoice
                  </button>
                </div>
              )}

              {selected.status === "SENT" && (
                <div className="border-t border-border pt-4">
                  <button
                    onClick={async () => {
                      const res = await fetch(`/api/admin/invoices/${selected.id}/download`);
                      const data = await res.json();
                      if (res.ok && data.data?.url) window.open(data.data.url, "_blank", "noopener,noreferrer");
                      else setError(data.error?.message || "Gagal membuka invoice");
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-surface-raised hover:bg-surface-raised text-text-primary rounded-lg text-sm font-medium transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Lihat PDF
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
