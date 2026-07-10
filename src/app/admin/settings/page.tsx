"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { Settings, Save, Check, AlertTriangle, X, Globe, CreditCard, MessageCircle, Bell } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

interface SettingItem {
  id: string; key: string; value: string; type: string; group_name: string;
}

const GROUPS = [
  { key: "general", label: "Umum", icon: Globe },
  { key: "payment", label: "Pembayaran", icon: CreditCard },
  { key: "social", label: "Sosial", icon: MessageCircle },
  { key: "notification", label: "Notifikasi", icon: Bell },
];

const DISPLAY_NAMES: Record<string, string> = {
  store_name: "Nama Toko", store_description: "Deskripsi Toko", currency: "Mata Uang",
  tax_rate: "Pajak (PPN)", min_order_amount: "Min. Pesanan",
  discord_link: "Link Discord", whatsapp_link: "Link WhatsApp",
  email: "Email Kontak", announcement: "Pengumuman",
};

export default function AdminSettingsPage() {
  const supabase = getSupabaseBrowser();
  const [settings, setSettings] = useState<SettingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeGroup, setActiveGroup] = useState("general");
  const [saving, setSaving] = useState(false);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [okMsg, setOkMsg] = useState("");
  const okTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showOk = useCallback((m: string) => { setOkMsg(m); if (okTimer.current) clearTimeout(okTimer.current); okTimer.current = setTimeout(() => setOkMsg(""), 3000); }, []);

  const fetchSettings = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const { data, error: err } = await supabase.from("setting").select("*").order("group_name").order("key");
      if (err) throw err;
      const items = (data || []) as SettingItem[];
      setSettings(items);
      const init: Record<string, string> = {};
      for (const item of items) init[item.key] = item.value;
      setEdited(init);
    } catch (e: any) { setError(e.message || "Gagal memuat"); }
    finally { setLoading(false); }
  }, [supabase]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const filtered = settings.filter(s => s.group_name === activeGroup);
  const hasChanges = filtered.some(s => edited[s.key] !== s.value);

  const handleSave = useCallback(async () => {
    setSaving(true); setError("");
    try {
      for (const setting of filtered) {
        const newVal = edited[setting.key];
        if (newVal !== setting.value) {
          // Upsert: check if exists
          const { data: existing } = await supabase.from("setting").select("id").eq("key", setting.key).limit(1);
          if (existing && existing.length > 0) {
            const { error: upErr } = await supabase.from("setting")
              .update({ value: newVal, type: setting.type, group_name: setting.group_name })
              .eq("key", setting.key);
            if (upErr) throw upErr;
          } else {
            const id = crypto.randomUUID().replace(/-/g, "").slice(0, 25);
            const { error: insErr } = await supabase.from("setting").insert({
              id, key: setting.key, value: newVal, type: setting.type, group_name: setting.group_name,
            });
            if (insErr) throw insErr;
          }
        }
      }
      showOk("Pengaturan disimpan");
      fetchSettings();
    } catch (e: any) { setError(e.message || "Gagal menyimpan"); }
    finally { setSaving(false); }
  }, [edited, filtered, supabase, fetchSettings, showOk]);

  const getName = (k: string) => DISPLAY_NAMES[k] || k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  const getType = (s: SettingItem) => s.type === "number" ? "number" : s.type === "url" ? "url" : s.type === "email" ? "email" : "text";
  const isTextarea = (k: string) => k === "store_description" || k === "announcement";

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-white">Pengaturan</h1><p className="text-text-secondary text-sm mt-1">Kelola pengaturan toko</p></div>
      {okMsg && <div className="bg-success/10 border border-success/20 text-success px-4 py-3 rounded-lg text-sm flex items-center gap-2 animate-fade-in"><Check className="h-4 w-4" />{okMsg}</div>}
      {error && <div className="bg-error/10 border border-error/20 text-error px-4 py-3 rounded-lg text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{error}<button onClick={() => setError("")} className="ml-auto"><X className="h-4 w-4" /></button></div>}

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-48 flex-shrink-0">
          <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
            {GROUPS.map(g => (
              <button key={g.key} onClick={() => setActiveGroup(g.key)}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  activeGroup === g.key ? "bg-arcane/20 text-arcane border border-arcane/20" : "text-text-secondary hover:text-text-primary hover:bg-surface-raised border border-transparent"
                }`}>
                <g.icon className="h-4 w-4" />{g.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 bg-surface border border-border rounded-xl p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12"><div className="flex items-center gap-2 text-text-secondary"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-arcane" /> Memuat...</div></div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-text-tertiary"><Settings className="h-10 w-10 opacity-30" /><p>Tidak ada pengaturan</p></div>
          ) : (
            <div className="space-y-5">
              {filtered.map(s => (
                <div key={s.id}>
                  <label className="block text-sm font-medium text-text-primary mb-1.5">{getName(s.key)} <span className="text-xs text-text-tertiary font-mono">({s.key})</span></label>
                  {isTextarea(s.key) ? (
                    <textarea value={edited[s.key] || ""} onChange={e => setEdited(p => ({ ...p, [s.key]: e.target.value }))} rows={3}
                      className="w-full px-4 py-2.5 bg-surface-raised border border-border rounded-lg text-white placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-arcane/50 text-sm resize-none" />
                  ) : (
                    <input type={getType(s)} value={edited[s.key] || ""} onChange={e => setEdited(p => ({ ...p, [s.key]: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-surface-raised border border-border rounded-lg text-white placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-arcane/50 text-sm" />
                  )}
                  {edited[s.key] !== s.value && <p className="text-xs text-arcane mt-1"><Check className="h-3 w-3 inline mr-0.5" /> Belum disimpan</p>}
                </div>
              ))}
              {hasChanges && (
                <div className="pt-4 border-t border-border">
                  <button onClick={handleSave} disabled={saving}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-ember to-ember-bright hover:from-ember-bright hover:to-ember-bright disabled:from-surface-raised disabled:to-surface-raised disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg shadow-lg shadow-ember/20">
                    {saving ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Menyimpan...</> : <><Save className="h-4 w-4" /> Simpan</>}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
