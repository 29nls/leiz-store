"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { Plus, Edit3, Trash2, FolderTree, X, Check, AlertTriangle } from "lucide-react";
import { getSupabaseBrowser, subscribeToTable } from "@/lib/supabase-browser";

interface Category {
  id: string; name: string; slug: string; description: string | null;
  icon: string | null; sort_order: number; is_active: boolean;
  product_count: number; created_at: string;
}

interface FormData {
  name: string; slug: string; description: string; icon: string;
  sort_order: string; is_active: boolean;
}

const EMPTY_FORM: FormData = { name: "", slug: "", description: "", icon: "", sort_order: "0", is_active: true };

function slugify(t: string): string {
  return t.toLowerCase().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
}

export default function AdminCategoriesPage() {
  const supabase = getSupabaseBrowser();
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [formErr, setFormErr] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [serverErr, setServerErr] = useState("");
  const [delTarget, setDelTarget] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [okMsg, setOkMsg] = useState("");
  const okTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showOk = useCallback((m: string) => {
    setOkMsg(m);
    if (okTimer.current) clearTimeout(okTimer.current);
    okTimer.current = setTimeout(() => setOkMsg(""), 3000);
  }, []);

  const fetchCats = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const { data, error: err } = await supabase.from("category").select("*").order("sort_order");
      if (err) throw err;
      // Add product counts
      const withCounts = await Promise.all((data || []).map(async (cat) => {
        const { count } = await supabase.from("product")
          .select("*", { count: "exact", head: true }).eq("category_id", cat.id);
        return { ...cat, product_count: count || 0 } as Category;
      }));
      setCats(withCounts);
    } catch (e: any) { setError(e.message || "Gagal memuat"); }
    finally { setLoading(false); }
  }, [supabase]);

  useEffect(() => { fetchCats(); }, [fetchCats]);
  useEffect(() => {
    const unsub = subscribeToTable("category", () => fetchCats());
    return unsub;
  }, [fetchCats]);

  const openCreate = () => { setEditingId(null); setForm(EMPTY_FORM); setFormErr({}); setServerErr(""); setShowModal(true); };
  const openEdit = (c: Category) => {
    setEditingId(c.id);
    setForm({ name: c.name, slug: c.slug, description: c.description || "", icon: c.icon || "", sort_order: String(c.sort_order), is_active: c.is_active });
    setFormErr({}); setServerErr(""); setShowModal(true);
  };
  const onNameChange = (v: string) => setForm(p => ({ ...p, name: v, slug: editingId ? p.slug : slugify(v) }));

  const validate = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Nama wajib diisi";
    if (!form.slug.trim()) errs.slug = "Slug wajib diisi";
    else if (!/^[a-z0-9-]+$/.test(form.slug)) errs.slug = "Hanya huruf kecil, angka, strip";
    return errs;
  };

  const handleSave = useCallback(async () => {
    const errs = validate(); setFormErr(errs);
    if (Object.keys(errs).length > 0) return;
    setSaving(true); setServerErr("");
    try {
      const payload: any = {
        name: form.name.trim(), slug: form.slug.trim(),
        description: form.description.trim() || null, icon: form.icon.trim() || null,
        sort_order: Number(form.sort_order), is_active: form.is_active,
        updated_at: new Date().toISOString(),
      };
      if (editingId) {
        const { error: upErr } = await supabase.from("category").update(payload).eq("id", editingId);
        if (upErr) { setServerErr(upErr.message); return; }
      } else {
        const id = crypto.randomUUID().replace(/-/g, "").slice(0, 25);
        payload.id = id; payload.created_at = new Date().toISOString();
        const { error: insErr } = await supabase.from("category").insert(payload);
        if (insErr) { setServerErr(insErr.message); return; }
      }
      setShowModal(false);
      showOk(editingId ? "Kategori diperbarui" : "Kategori dibuat");
      fetchCats();
    } catch (e: any) { setServerErr(e.message || "Gagal menyimpan"); }
    finally { setSaving(false); }
  }, [form, editingId, supabase, fetchCats, showOk]); // eslint-disable-line react-hooks/exhaustive-deps -- validate is a local fn, always fresh in closure

  const handleDelete = useCallback(async () => {
    if (!delTarget) return;
    setDeleting(true);
    try {
      const { error: dErr } = await supabase.from("category").delete().eq("id", delTarget.id);
      if (dErr) throw dErr;
      setDelTarget(null); showOk("Kategori dihapus"); fetchCats();
    } catch (e: any) { setError(e.message || "Gagal menghapus"); }
    finally { setDeleting(false); }
  }, [delTarget, supabase, fetchCats, showOk]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-text-primary">Kategori</h1><p className="text-text-secondary text-sm mt-1">Kelola kategori produk</p></div>
        <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-ember to-ember-bright hover:from-ember-bright hover:to-ember-bright text-text-primary text-sm font-medium rounded-lg shadow-lg shadow-ember/20">
          <Plus className="h-4 w-4" /> Tambah Kategori
        </button>
      </div>

      {okMsg && <div className="bg-success/10 border border-success/20 text-success px-4 py-3 rounded-lg text-sm flex items-center gap-2 animate-fade-in"><Check className="h-4 w-4" />{okMsg}</div>}
      {error && <div className="bg-error/10 border border-error/20 text-error px-4 py-3 rounded-lg text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{error}<button onClick={() => setError("")} className="ml-auto"><X className="h-4 w-4" /></button></div>}

      {loading ? (
        <div className="flex items-center justify-center py-12"><div className="flex items-center gap-2 text-text-secondary"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-arcane" /> Memuat...</div></div>
      ) : cats.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-text-tertiary"><FolderTree className="h-12 w-12 opacity-30" /><p>Belum ada kategori</p><button onClick={openCreate} className="text-arcane hover:arcane text-sm">Buat kategori</button></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cats.map(c => (
            <div key={c.id} className={`bg-surface border rounded-xl p-5 transition-all hover:border-border ${c.is_active ? "border-border" : "border-border opacity-70"}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-arcane/20 to-arcane/20 flex items-center justify-center text-lg">{c.icon || "📁"}</div>
                  <div><h3 className="text-text-primary font-medium">{c.name}</h3><p className="text-xs text-text-tertiary font-mono">/{c.slug}</p></div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(c)} className="p-1.5 text-text-secondary hover:text-arcane hover:bg-arcane/10 rounded-lg"><Edit3 className="h-3.5 w-3.5" /></button>
                  <button onClick={() => setDelTarget(c)} className="p-1.5 text-text-secondary hover:text-error hover:bg-error/10 rounded-lg"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
              {c.description && <p className="text-sm text-text-secondary mb-3 line-clamp-2">{c.description}</p>}
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-tertiary">{c.product_count} produk</span>
                <span className={`px-2 py-0.5 rounded-full ${c.is_active ? "bg-success/10 text-success" : "bg-surface-raised text-text-secondary"}`}>{c.is_active ? "Aktif" : "Nonaktif"}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-lg bg-surface border border-border rounded-xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold text-text-primary">{editingId ? "Edit" : "Tambah"} Kategori</h2>
              <button onClick={() => setShowModal(false)} className="p-2 text-text-secondary hover:text-text-primary hover:bg-surface-raised rounded-lg"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              {serverErr && <div className="bg-error/10 border border-error/20 text-error px-4 py-3 rounded-lg text-sm">{serverErr}</div>}
              <div><label className="block text-sm font-medium text-text-primary mb-1.5">Nama <span className="text-error">*</span></label>
                <input type="text" value={form.name} onChange={e => onNameChange(e.target.value)}
                  className={`w-full px-4 py-2.5 bg-surface-raised border rounded-lg text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-arcane/50 ${formErr.name ? "border-error" : "border-border"}`} />
                {formErr.name && <p className="text-error text-xs mt-1">{formErr.name}</p>}
              </div>
              <div><label className="block text-sm font-medium text-text-primary mb-1.5">Slug <span className="text-error">*</span></label>
                <input type="text" value={form.slug} onChange={e => setForm(p => ({ ...p, slug: slugify(e.target.value) }))}
                  className={`w-full px-4 py-2.5 bg-surface-raised border rounded-lg text-text-primary text-sm font-mono focus:outline-none focus:ring-2 focus:ring-arcane/50 ${formErr.slug ? "border-error" : "border-border"}`} />
                {formErr.slug && <p className="text-error text-xs mt-1">{formErr.slug}</p>}
              </div>
              <div><label className="block text-sm font-medium text-text-primary mb-1.5">Deskripsi</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} className="w-full px-4 py-2.5 bg-surface-raised border border-border rounded-lg text-text-primary text-sm resize-none focus:outline-none focus:ring-2 focus:ring-arcane/50" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-text-primary mb-1.5">Icon</label>
                  <input type="text" value={form.icon} onChange={e => setForm(p => ({ ...p, icon: e.target.value }))} placeholder="⚔️" maxLength={10} className="w-full px-4 py-2.5 bg-surface-raised border border-border rounded-lg text-text-primary text-sm" />
                </div>
                <div><label className="block text-sm font-medium text-text-primary mb-1.5">Urutan</label>
                  <input type="number" value={form.sort_order} onChange={e => setForm(p => ({ ...p, sort_order: e.target.value }))} min="0" className="w-full px-4 py-2.5 bg-surface-raised border border-border rounded-lg text-text-primary text-sm" />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer pt-2">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} className="w-4 h-4 rounded border-border bg-surface-raised text-arcane focus:ring-arcane cursor-pointer" />
                <span className="text-sm text-text-primary">Aktif</span>
              </label>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
              <button onClick={() => setShowModal(false)} className="px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-raised rounded-lg">Batal</button>
              <button onClick={handleSave} disabled={saving}
                className="px-6 py-2.5 bg-gradient-to-r from-ember to-ember-bright hover:from-ember-bright hover:to-ember-bright disabled:from-surface-raised disabled:to-surface-raised disabled:cursor-not-allowed text-text-primary text-sm font-medium rounded-lg flex items-center gap-2 shadow-lg shadow-ember/20">
                {saving ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Menyimpan...</> : <><Check className="h-4 w-4" /> {editingId ? "Simpan" : "Buat"}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {delTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDelTarget(null)} />
          <div className="relative w-full max-w-md bg-surface border border-border rounded-xl shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center"><AlertTriangle className="h-6 w-6 text-error" /></div>
              <div><h3 className="text-lg font-semibold text-text-primary">Hapus Kategori</h3><p className="text-sm text-text-secondary">Tindakan ini tidak dapat dibatalkan</p></div>
            </div>
            <p className="text-text-primary text-sm mb-2">Hapus &quot;{delTarget.name}&quot;?</p>
            {delTarget.product_count > 0 && (
              <div className="bg-warning/10 border border-warning/20 text-warning px-4 py-3 rounded-lg text-sm mb-4">
                ⚠️ {delTarget.product_count} produk terhubung. Pindahkan dulu sebelum menghapus.
              </div>
            )}
            <div className="flex items-center justify-end gap-3 mt-6">
              <button onClick={() => setDelTarget(null)} disabled={deleting} className="px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-raised rounded-lg">Batal</button>
              <button onClick={handleDelete} disabled={deleting || delTarget.product_count > 0}
                className="px-6 py-2.5 bg-error hover:bg-error/80 disabled:bg-surface-raised disabled:cursor-not-allowed text-text-primary text-sm font-medium rounded-lg flex items-center gap-2">
                {deleting ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Menghapus...</> : <><Trash2 className="h-4 w-4" /> Ya, Hapus</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
