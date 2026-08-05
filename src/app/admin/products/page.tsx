/* eslint-disable @next/next/no-img-element -- admin panel: preview images, not user-facing */
"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Plus, Search, Edit3, Trash2, Package, X, Check, AlertTriangle, ImageIcon,
  ChevronLeft, ChevronRight, Eye, EyeOff,
} from "lucide-react";
import { subscribeToTable } from "@/lib/supabase-browser";

// ─── Types ────────────────────────────────────────────────────

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface ProductImage {
  id: string;
  url: string;
  alt: string;
  sort_order: number;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  compare_price: number | null;
  unit: string;
  stock: number;
  min_stock: number;
  badge: string | null;
  is_active: boolean;
  is_featured: boolean;
  category_id: string;
  category: Category | null;
  images: ProductImage[];
  created_at: string;
}

interface ProductFormData {
  name: string;
  slug: string;
  description: string;
  price: string;
  compare_price: string;
  unit: string;
  stock: string;
  min_stock: string;
  badge: string;
  is_active: boolean;
  is_featured: boolean;
  category_id: string;
  image_url: string;
}

const EMPTY_FORM: ProductFormData = {
  name: "", slug: "", description: "", price: "", compare_price: "",
  unit: "pc", stock: "0", min_stock: "5", badge: "", is_active: true,
  is_featured: false, category_id: "", image_url: "",
};

const BADGE_OPTIONS = [
  { value: "", label: "Tidak ada" }, { value: "HOT", label: "HOT" },
  { value: "NEW", label: "NEW" }, { value: "BEST_SELLER", label: "BEST SELLER" },
  { value: "LIMITED", label: "LIMITED" }, { value: "SALE", label: "SALE" },
];

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
}

function fmtIDR(n: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for future formatting
function fmtDate(s: string): string {
  return new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function validateForm(data: ProductFormData): Record<string, string> {
  const e: Record<string, string> = {};
  if (!data.name.trim()) e.name = "Nama produk wajib diisi";
  else if (data.name.length < 2) e.name = "Minimal 2 karakter";
  else if (data.name.length > 200) e.name = "Maksimal 200 karakter";
  if (!data.slug.trim()) e.slug = "Slug wajib diisi";
  else if (!/^[a-z0-9-]+$/.test(data.slug)) e.slug = "Hanya huruf kecil, angka, strip";
  const p = Number(data.price);
  if (!data.price || isNaN(p) || p < 0) e.price = "Harga harus positif";
  else if (p > 9999999999) e.price = "Terlalu besar";
  if (data.compare_price) {
    const cp = Number(data.compare_price);
    if (isNaN(cp) || cp < 0) e.compare_price = "Harus positif";
    else if (cp <= p) e.compare_price = "Harus lebih besar dari harga";
  }
  const st = Number(data.stock);
  if (data.stock === "" || isNaN(st) || st < 0 || !Number.isInteger(st)) e.stock = "Stok harus bilangan bulat positif";
  const ms = Number(data.min_stock);
  if (data.min_stock === "" || isNaN(ms) || ms < 0 || !Number.isInteger(ms)) e.min_stock = "Min stok harus bilangan bulat";
  if (!data.unit.trim()) e.unit = "Unit wajib diisi";
  if (!data.category_id) e.category_id = "Kategori wajib dipilih";
  return e;
}

// ─── Component ────────────────────────────────────────────────

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [searchDb, setSearchDb] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductFormData>(EMPTY_FORM);
  const [formErr, setFormErr] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [serverErr, setServerErr] = useState("");
  const [uploading, setUploading] = useState(false);
  const [delTarget, setDelTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [okMsg, setOkMsg] = useState("");
  const okTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showOk = useCallback((m: string) => {
    setOkMsg(m);
    if (okTimer.current) clearTimeout(okTimer.current);
    okTimer.current = setTimeout(() => setOkMsg(""), 3000);
  }, []);

  // ── Fetch ──────────────────────────────────────────────────

  const fetchProducts = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (searchDb) params.set("search", searchDb);
      if (catFilter) params.set("category", catFilter);

      const res = await fetch(`/api/admin/products?${params}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || "Gagal memuat produk");
      }
      const data = await res.json();
      setProducts(data.data || []);
      setTotalPages(data.meta?.totalPages || 1);
      setTotal(data.meta?.total || 0);
    } catch (e: any) { setError(e.message || "Gagal memuat produk"); }
    finally { setLoading(false); }
  }, [searchDb, catFilter, page]);

  const fetchCats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/categories");
      if (res.ok) {
        const data = await res.json();
        setCategories((data.data || []) as any);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchCats(); }, [fetchCats]);
  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  useEffect(() => {
    const unsub = subscribeToTable("product", () => fetchProducts());
    return unsub;
  }, [fetchProducts]);

  useEffect(() => {
    const t = setTimeout(() => setSearchDb(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [searchDb, catFilter]);

  // ── Modal helpers ──────────────────────────────────────────

  const openCreate = () => {
    setEditingId(null); setForm(EMPTY_FORM); setFormErr({}); setServerErr(""); setShowModal(true);
  };
  const openEdit = (p: Product) => {
    setEditingId(p.id);
    setForm({
      name: p.name, slug: p.slug, description: p.description || "", price: String(p.price),
      compare_price: p.compare_price ? String(p.compare_price) : "", unit: p.unit,
      stock: String(p.stock), min_stock: String(p.min_stock), badge: p.badge || "",
      is_active: p.is_active, is_featured: p.is_featured, category_id: p.category_id,
      image_url: p.images?.[0]?.url || "",
    });
    setFormErr({}); setServerErr(""); setShowModal(true);
  };
  const onNameChange = (v: string) => setForm((prev) => ({ ...prev, name: v, slug: editingId ? prev.slug : slugify(v) }));

  // ── Save ───────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    const errs = validateForm(form);
    setFormErr(errs);
    if (Object.keys(errs).length > 0) return;
    setSaving(true); setServerErr("");
    try {
      const payload: any = {
        name: form.name.trim(), slug: form.slug.trim(), description: form.description.trim(),
        price: Number(form.price), unit: form.unit, stock: Number(form.stock),
        min_stock: Number(form.min_stock), is_active: form.is_active,
        is_featured: form.is_featured, category_id: form.category_id,
      };
      if (form.compare_price) payload.compare_price = Number(form.compare_price);
      if (form.badge) payload.badge = form.badge;

      // Map snake_case form to camelCase API fields
      const apiPayload: any = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        description: form.description.trim(),
        price: Number(form.price),
        unit: form.unit,
        stock: Number(form.stock),
        minStock: Number(form.min_stock),
        isActive: form.is_active,
        isFeatured: form.is_featured,
        categoryId: form.category_id,
      };
      if (form.compare_price) apiPayload.comparePrice = Number(form.compare_price);
      if (form.badge) apiPayload.badge = form.badge;
      if (form.image_url.trim()) {
        apiPayload.images = [{ url: form.image_url.trim(), alt: form.name.trim() }];
      }

      if (editingId) {
        const res = await fetch(`/api/admin/products/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(apiPayload),
        });
        const data = await res.json();
        if (!res.ok) { setServerErr(data.error?.message || "Gagal memperbarui"); return; }
      } else {
        const res = await fetch("/api/admin/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(apiPayload),
        });
        const data = await res.json();
        if (!res.ok) { setServerErr(data.error?.message || "Gagal membuat"); return; }
      }
      setShowModal(false);
      showOk(editingId ? "Produk berhasil diperbarui" : "Produk berhasil dibuat");
      fetchProducts();
    } catch (e: any) { setServerErr(e.message || "Terjadi kesalahan"); }
    finally { setSaving(false); }
  }, [form, editingId, fetchProducts, showOk]);

  // ── Delete ─────────────────────────────────────────────────

  const handleDelete = useCallback(async () => {
    if (!delTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/products/${delTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { setError(data.error?.message || "Gagal menghapus"); return; }
      setDelTarget(null);
      showOk("Produk berhasil dihapus");
      fetchProducts();
    } catch (e: any) { setError(e.message || "Gagal menghapus"); }
    finally { setDeleting(false); }
  }, [delTarget, fetchProducts, showOk]);

  // ── Toggle active ──────────────────────────────────────────

  const toggleActive = useCallback(async (p: Product) => {
    try {
      const res = await fetch(`/api/admin/products/${p.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !p.is_active }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.message || "Gagal mengubah status");
        return;
      }
      showOk(p.is_active ? "Produk dinonaktifkan" : "Produk diaktifkan");
      fetchProducts();
    } catch (e: any) { setError(e.message); }
  }, [fetchProducts, showOk]);

  // ── Image upload ──────────────────────────────────────────

  const handleUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setServerErr("File harus berupa gambar");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setServerErr("File maksimal 5MB");
      return;
    }
    setUploading(true);
    setServerErr("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setServerErr(data.error?.message || "Gagal upload"); return; }
      setForm((prev) => ({ ...prev, image_url: data.data?.url }));
    } catch (e: any) { setServerErr(e.message || "Gagal upload"); }
    finally { setUploading(false); }
  }, []);

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Produk</h1>
          <p className="text-text-secondary text-sm mt-1">Kelola semua produk toko Anda</p>
        </div>
        <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2.5 bg-ember hover:bg-ember-bright text-void text-sm font-medium rounded-lg transition-all duration-200 shadow-lg shadow-ember/20">
          <Plus className="h-4 w-4" /> Tambah Produk
        </button>
      </div>

      {okMsg && <div className="bg-success/10 border border-success/20 text-success px-4 py-3 rounded-lg text-sm flex items-center gap-2 animate-fade-in"><Check className="h-4 w-4" />{okMsg}</div>}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari produk..." className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-arcane/50 focus:border-arcane/50 text-sm" />
        </div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="px-4 py-2.5 bg-surface border border-border rounded-lg text-text-secondary text-sm focus:outline-none focus:ring-2 focus:ring-arcane/50">
          <option value="">Semua Kategori</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {error && (
        <div className="bg-error/10 border border-error/20 text-error px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />{error}
          <button onClick={() => setError("")} className="ml-auto hover:text-red-300"><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-raised">
                <th className="text-left py-3 px-4 text-text-secondary font-medium">Produk</th>
                <th className="text-left py-3 px-4 text-text-secondary font-medium">Kategori</th>
                <th className="text-right py-3 px-4 text-text-secondary font-medium">Harga</th>
                <th className="text-center py-3 px-4 text-text-secondary font-medium">Stok</th>
                <th className="text-center py-3 px-4 text-text-secondary font-medium">Status</th>
                <th className="text-right py-3 px-4 text-text-secondary font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={6} className="py-12 text-center">
                  <div className="flex items-center justify-center gap-2 text-text-secondary">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-arcane" /> Memuat produk...
                  </div>
                </td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-text-tertiary">
                    <Package className="h-10 w-10 opacity-30" /><p>Tidak ada produk</p>
                     <button onClick={openCreate} className="text-arcane hover:text-arcane text-sm font-medium">Tambah produk</button>
                  </div>
                </td></tr>
              ) : products.map(p => (
                <tr key={p.id} className="hover:bg-surface-raised transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-surface-raised flex items-center justify-center overflow-hidden flex-shrink-0">
                        {p.images?.[0]?.url ? (
                          <img src={p.images[0].url} alt={p.name} className="w-full h-full object-cover"
                            onError={e => { (e.target as HTMLImageElement).src = "https://placehold.co/400x400/222329/D3BC8E?text=LEIZ"; }} />
                        ) : <ImageIcon className="h-5 w-5 text-text-tertiary" />}
                      </div>
                      <div>
                        <p className="text-text-primary font-medium max-w-[250px] truncate">{p.name}</p>
                        {p.badge &&                         <span className={`inline-block text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                          p.badge === "HOT" ? "bg-error/20 text-error" : p.badge === "NEW" ? "bg-success/20 text-success" :
                          p.badge === "BEST_SELLER" ? "bg-arcane/20 text-arcane" : p.badge === "LIMITED" ? "bg-warning/20 text-warning" :
                          "bg-surface-raised text-text-tertiary"
                        }`}>{p.badge}</span>}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-text-secondary">{p.category?.name || "-"}</td>
                  <td className="py-3 px-4 text-right text-text-primary font-medium">
                    {fmtIDR(p.price)}
                    {p.compare_price && <span className="block text-xs text-text-tertiary line-through">{fmtIDR(p.compare_price)}</span>}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`font-medium ${p.stock <= 0 ? "text-error" : p.stock <= p.min_stock ? "text-warning" : "text-success"}`}>{p.stock}</span>
                    <span className="text-text-tertiary text-xs block">{p.unit}</span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button onClick={() => toggleActive(p)} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                      p.is_active ? "bg-success/10 text-success hover:bg-success/20" : "bg-error/10 text-error hover:bg-error/20"
                    }`}>
                      {p.is_active ? <><Eye className="h-3 w-3" /> Aktif</> : <><EyeOff className="h-3 w-3" /> Nonaktif</>}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(p)} className="p-2 text-text-secondary hover:text-arcane hover:bg-arcane/10 rounded-lg" title="Edit"><Edit3 className="h-4 w-4" /></button>
                      <button onClick={() => setDelTarget(p)} className="p-2 text-text-secondary hover:text-error hover:bg-error/10 rounded-lg" title="Hapus"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-sm text-text-secondary">{total} produk</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="p-2 text-text-secondary hover:text-text-primary disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
              <span className="text-sm text-text-secondary px-2">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-2 text-text-secondary hover:text-text-primary disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </div>

      {/* ── Create/Edit Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-2xl bg-surface border border-border rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-surface border-b border-border px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-semibold text-text-primary">{editingId ? "Edit Produk" : "Tambah Produk"}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 text-text-secondary hover:text-text-primary hover:bg-surface-raised rounded-lg"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 space-y-5">
              {serverErr && <div className="bg-error/10 border border-error/20 text-error px-4 py-3 rounded-lg text-sm">{serverErr}</div>}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Nama Produk <span className="text-error">*</span></label>
                  <input type="text" value={form.name} onChange={e => onNameChange(e.target.value)} placeholder="Nama produk"
                    className={`w-full px-4 py-2.5 bg-surface-raised border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-arcane/50 text-sm ${formErr.name ? "border-error" : "border-border"}`} />
                  {formErr.name && <p className="text-error text-xs mt-1">{formErr.name}</p>}
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Slug <span className="text-error">*</span></label>
                  <input type="text" value={form.slug} onChange={e => setForm(p => ({ ...p, slug: slugify(e.target.value) }))} placeholder="nama-produk"
                    className={`w-full px-4 py-2.5 bg-surface-raised border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-arcane/50 text-sm font-mono ${formErr.slug ? "border-error" : "border-border"}`} />
                  {formErr.slug && <p className="text-error text-xs mt-1">{formErr.slug}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Harga (Rp) <span className="text-error">*</span></label>
                  <input type="number" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} placeholder="0" min="0"
                    className={`w-full px-4 py-2.5 bg-surface-raised border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-arcane/50 text-sm ${formErr.price ? "border-error" : "border-border"}`} />
                  {formErr.price && <p className="text-error text-xs mt-1">{formErr.price}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Harga Coret (Rp)</label>
                  <input type="number" value={form.compare_price} onChange={e => setForm(p => ({ ...p, compare_price: e.target.value }))} placeholder="0" min="0"
                    className={`w-full px-4 py-2.5 bg-surface-raised border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-arcane/50 text-sm ${formErr.compare_price ? "border-error" : "border-border"}`} />
                  {formErr.compare_price && <p className="text-error text-xs mt-1">{formErr.compare_price}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Stok <span className="text-error">*</span></label>
                  <input type="number" value={form.stock} onChange={e => setForm(p => ({ ...p, stock: e.target.value }))} placeholder="0" min="0"
                    className={`w-full px-4 py-2.5 bg-surface-raised border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-arcane/50 text-sm ${formErr.stock ? "border-error" : "border-border"}`} />
                  {formErr.stock && <p className="text-error text-xs mt-1">{formErr.stock}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Min. Stok <span className="text-error">*</span></label>
                  <input type="number" value={form.min_stock} onChange={e => setForm(p => ({ ...p, min_stock: e.target.value }))} placeholder="5" min="0"
                    className={`w-full px-4 py-2.5 bg-surface-raised border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-arcane/50 text-sm ${formErr.min_stock ? "border-error" : "border-border"}`} />
                  {formErr.min_stock && <p className="text-error text-xs mt-1">{formErr.min_stock}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Unit <span className="text-error">*</span></label>
                  <input type="text" value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} placeholder="pc"
                    className={`w-full px-4 py-2.5 bg-surface-raised border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-arcane/50 text-sm ${formErr.unit ? "border-error" : "border-border"}`} />
                  {formErr.unit && <p className="text-error text-xs mt-1">{formErr.unit}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Badge</label>
                  <select value={form.badge} onChange={e => setForm(p => ({ ...p, badge: e.target.value }))} className="w-full px-4 py-2.5 bg-surface-raised border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-arcane/50 text-sm">
                    {BADGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Kategori <span className="text-error">*</span></label>
                  <select value={form.category_id} onChange={e => setForm(p => ({ ...p, category_id: e.target.value }))}
                    className={`w-full px-4 py-2.5 bg-surface-raised border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-arcane/50 text-sm ${formErr.category_id ? "border-error" : "border-border"}`}>
                    <option value="">Pilih kategori...</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  {formErr.category_id && <p className="text-error text-xs mt-1">{formErr.category_id}</p>}
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Deskripsi</label>
                  <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Deskripsi produk..." rows={3}
                    className="w-full px-4 py-2.5 bg-surface-raised border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-arcane/50 text-sm resize-none" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Gambar Produk</label>
                  <div className="flex gap-3 items-start">
                    <div className="flex-1 space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer px-4 py-2.5 bg-surface-raised border border-border rounded-lg text-sm text-text-secondary hover:text-text-primary hover:border-arcane/30 transition-all">
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/avif"
                          className="hidden"
                          disabled={uploading}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleUpload(f);
                            e.target.value = "";
                          }}
                        />
                        {uploading ? (
                          <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-arcane" /> Mengupload...</>
                        ) : (
                          <><ImageIcon className="h-4 w-4" /> Pilih File</>
                        )}
                      </label>
                      <input type="url" value={form.image_url} onChange={e => setForm(p => ({ ...p, image_url: e.target.value }))} placeholder="Atau masukkan URL gambar..."
                        className="w-full px-4 py-2.5 bg-surface-raised border border-border rounded-lg text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-arcane/50 text-sm" />
                    </div>
                    {form.image_url && (
                      <div className="w-20 h-20 rounded-lg bg-surface-raised border border-border overflow-hidden flex-shrink-0">
                        <img src={form.image_url} alt={form.name || "Preview"} className="w-full h-full object-cover"
                          onError={e => { (e.target as HTMLImageElement).src = "https://placehold.co/400x400/222329/D3BC8E?text=LEIZ"; }} />
                      </div>
                    )}
                  </div>
                </div>
                <div className="md:col-span-2 flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
                      className="w-4 h-4 rounded border-border bg-surface-raised text-arcane focus:ring-arcane focus:ring-offset-0 cursor-pointer" />
                    <span className="text-sm text-text-secondary">Aktif</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.is_featured} onChange={e => setForm(p => ({ ...p, is_featured: e.target.checked }))}
                      className="w-4 h-4 rounded border-border bg-surface-raised text-arcane focus:ring-arcane focus:ring-offset-0 cursor-pointer" />
                    <span className="text-sm text-text-secondary">Unggulan</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="sticky bottom-0 bg-surface border-t border-border px-6 py-4 flex items-center justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-raised rounded-lg">Batal</button>
              <button onClick={handleSave} disabled={saving}
                className="px-6 py-2.5 bg-ember hover:bg-ember-bright disabled:bg-surface-raised disabled:text-text-tertiary disabled:cursor-not-allowed text-void text-sm font-medium rounded-lg flex items-center gap-2 shadow-lg shadow-ember/20">
                {saving ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-void" /> Menyimpan...</> : <><Check className="h-4 w-4" /> {editingId ? "Simpan" : "Buat"}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation ── */}
      {delTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDelTarget(null)} />
          <div className="relative w-full max-w-md bg-surface border border-border rounded-xl shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center"><AlertTriangle className="h-6 w-6 text-error" /></div>
              <div><h3 className="text-lg font-semibold text-text-primary">Hapus Produk</h3><p className="text-sm text-text-secondary">Tindakan ini tidak dapat dibatalkan</p></div>
            </div>
            <p className="text-text-secondary text-sm mb-6">Apakah Anda yakin ingin menghapus <span className="text-text-primary font-medium">&quot;{delTarget.name}&quot;</span>?</p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setDelTarget(null)} disabled={deleting} className="px-4 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-raised rounded-lg">Batal</button>
              <button onClick={handleDelete} disabled={deleting}
                className="px-6 py-2.5 bg-error hover:bg-error/80 disabled:bg-surface-raised disabled:cursor-not-allowed text-void text-sm font-medium rounded-lg flex items-center gap-2">
                {deleting ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-void" /> Menghapus...</> : <><Trash2 className="h-4 w-4" /> Ya, Hapus</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
