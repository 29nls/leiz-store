"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Users, Plus, Search, Shield, ShieldOff, Edit3, Trash2,
  X, Check, AlertTriangle, ChevronLeft, ChevronRight, UserPlus,
  Eye, EyeOff, Mail, Key,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  discord: string | null;
  phone: string | null;
  is_active: boolean;
  last_sign_in_at: string | null;
  created_at: string;
  banned_until: string | null;
}

interface UserFormData {
  name: string;
  email: string;
  password: string;
  role: string;
  discord: string;
  phone: string;
}

const EMPTY_FORM: UserFormData = {
  name: "", email: "", password: "", role: "ADMIN", discord: "", phone: "",
};

// ─── Helpers ──────────────────────────────────────────────────

function fmtDate(s: string | null): string {
  if (!s) return "-";
  return new Date(s).toLocaleDateString("id-ID", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function validateForm(data: UserFormData, isEdit: boolean): Record<string, string> {
  const e: Record<string, string> = {};
  if (!data.name.trim()) e.name = "Nama wajib diisi";
  else if (data.name.length < 2) e.name = "Minimal 2 karakter";
  if (!data.email.trim()) e.email = "Email wajib diisi";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) e.email = "Format email tidak valid";
  if (!isEdit) {
    if (!data.password) e.password = "Password wajib diisi";
    else if (data.password.length < 6) e.password = "Minimal 6 karakter";
  } else if (data.password && data.password.length < 6) {
    e.password = "Minimal 6 karakter";
  }
  return e;
}

// ─── Component ────────────────────────────────────────────────

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [searchDb, setSearchDb] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<UserFormData>(EMPTY_FORM);
  const [formErr, setFormErr] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [serverErr, setServerErr] = useState("");
  const [delTarget, setDelTarget] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [okMsg, setOkMsg] = useState("");
  const okTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showOk = useCallback((m: string) => {
    setOkMsg(m);
    if (okTimer.current) clearTimeout(okTimer.current);
    okTimer.current = setTimeout(() => setOkMsg(""), 3000);
  }, []);

  // ── Fetch ──────────────────────────────────────────────────

  const fetchUsers = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (searchDb) params.set("search", searchDb);
      if (roleFilter) params.set("role", roleFilter);

      const res = await fetch(`/api/admin/users?${params}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Gagal memuat data");
      }
      const data = await res.json();
      setUsers(data.users || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch (e: any) {
      setError(e.message || "Gagal memuat data user");
    } finally {
      setLoading(false);
    }
  }, [searchDb, roleFilter, page]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  useEffect(() => {
    const t = setTimeout(() => setSearchDb(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [searchDb, roleFilter]);

  // ── Modal helpers ──────────────────────────────────────────

  const openCreate = () => {
    setEditingId(null); setForm(EMPTY_FORM); setFormErr({});
    setServerErr(""); setShowPassword(false); setShowModal(true);
  };

  const openEdit = (u: AdminUser) => {
    setEditingId(u.id);
    setForm({
      name: u.name, email: u.email, password: "",
      role: u.role, discord: u.discord || "", phone: u.phone || "",
    });
    setFormErr({}); setServerErr(""); setShowPassword(false); setShowModal(true);
  };

  // ── Save ───────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    const isEdit = !!editingId;
    const errs = validateForm(form, isEdit);
    setFormErr(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true); setServerErr("");
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        discord: form.discord.trim() || null,
        phone: form.phone.trim() || null,
      };
      if (form.password) payload.password = form.password;

      const url = isEdit ? `/api/admin/users/${editingId}` : "/api/admin/users";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setServerErr(data.error || "Gagal menyimpan");
        return;
      }

      setShowModal(false);
      showOk(isEdit ? "User berhasil diperbarui" : "Admin berhasil dibuat");
      fetchUsers();
    } catch (e: any) {
      setServerErr(e.message || "Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  }, [form, editingId, fetchUsers, showOk]);

  // ── Deactivate ─────────────────────────────────────────────

  const handleDeactivate = useCallback(async () => {
    if (!delTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/users/${delTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Gagal menonaktifkan");
        return;
      }
      setDelTarget(null);
      showOk("User berhasil dinonaktifkan");
      fetchUsers();
    } catch (e: any) {
      setError(e.message || "Gagal menonaktifkan user");
    } finally {
      setDeleting(false);
    }
  }, [delTarget, fetchUsers, showOk]);

  // ── Toggle active (re-activate) ────────────────────────────

  const handleReactivate = useCallback(async (u: AdminUser) => {
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: true }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Gagal mengaktifkan");
        return;
      }
      showOk("User berhasil diaktifkan kembali");
      fetchUsers();
    } catch (e: any) {
      setError(e.message || "Gagal mengaktifkan user");
    }
  }, [fetchUsers, showOk]);

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Manajemen User</h1>
          <p className="text-gray-400 text-sm mt-1">Kelola akun admin dan pengguna</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-lg shadow-blue-600/20"
        >
          <UserPlus className="h-4 w-4" /> Tambah Admin
        </button>
      </div>

      {/* Success message */}
      {okMsg && (
        <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg text-sm flex items-center gap-2 animate-fade-in">
          <Check className="h-4 w-4" />{okMsg}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama atau email..."
            className="w-full pl-10 pr-4 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 text-sm"
          />
        </div>
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="px-4 py-2.5 bg-gray-900 border border-gray-800 rounded-lg text-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        >
          <option value="">Semua Role</option>
          <option value="ADMIN">Admin</option>
          <option value="CUSTOMER">Customer</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />{error}
          <button onClick={() => setError("")} className="ml-auto hover:text-red-300">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-gray-900/80 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/50">
                <th className="text-left py-3 px-4 text-gray-400 font-medium">User</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium hidden md:table-cell">Role</th>
                <th className="text-center py-3 px-4 text-gray-400 font-medium">Status</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium hidden lg:table-cell">Terakhir Login</th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <div className="flex items-center justify-center gap-2 text-gray-400">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500" />
                      Memuat data user...
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-500">
                      <Users className="h-10 w-10 opacity-30" />
                      <p>Tidak ada user ditemukan</p>
                      <button onClick={openCreate} className="text-blue-400 hover:text-blue-300 text-sm font-medium">
                        Tambah admin
                      </button>
                    </div>
                  </td>
                </tr>
              ) : users.map(u => (
                <tr key={u.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600/30 to-purple-600/30 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-white font-medium truncate">{u.name}</p>
                        <p className="text-xs text-gray-500 truncate">{u.email}</p>
                        {u.discord && (
                          <p className="text-xs text-gray-600 truncate">Discord: {u.discord}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 hidden md:table-cell">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                      u.role === "ADMIN"
                        ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                        : "bg-gray-500/10 text-gray-400 border border-gray-500/20"
                    }`}>
                      {u.role === "ADMIN" ? <Shield className="h-3 w-3" /> : <ShieldOff className="h-3 w-3" />}
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                      u.is_active && !u.banned_until
                        ? "bg-green-500/10 text-green-400"
                        : "bg-red-500/10 text-red-400"
                    }`}>
                      {u.is_active && !u.banned_until ? (
                        <><Eye className="h-3 w-3" /> Aktif</>
                      ) : (
                        <><EyeOff className="h-3 w-3" /> Nonaktif</>
                      )}
                    </span>
                  </td>
                  <td className="py-3 px-4 hidden lg:table-cell text-gray-400 text-xs">
                    {u.last_sign_in_at ? fmtDate(u.last_sign_in_at) : (
                      <span className="text-gray-600">Belum pernah login</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(u)}
                        className="p-2 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg"
                        title="Edit"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      {u.is_active ? (
                        <button
                          onClick={() => setDelTarget(u)}
                          className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg"
                          title="Nonaktifkan"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReactivate(u)}
                          className="p-2 text-gray-400 hover:text-green-400 hover:bg-green-500/10 rounded-lg"
                          title="Aktifkan kembali"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
            <p className="text-sm text-gray-400">{total} user</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-2 text-gray-400 hover:text-white disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm text-gray-400 px-2">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-2 text-gray-400 hover:text-white disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Create/Edit Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-lg bg-gray-900 border border-gray-800 rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-semibold text-white">
                {editingId ? "Edit User" : "Tambah Admin Baru"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {serverErr && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
                  {serverErr}
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Nama <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Nama lengkap"
                  className={`w-full px-4 py-2.5 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm ${
                    formErr.name ? "border-red-500" : "border-gray-700"
                  }`}
                />
                {formErr.name && <p className="text-red-400 text-xs mt-1">{formErr.name}</p>}
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Email <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="user@example.com"
                    disabled={!!editingId}
                    className={`w-full pl-10 pr-4 py-2.5 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm ${
                      formErr.email ? "border-red-500" : "border-gray-700"
                    } ${editingId ? "opacity-60 cursor-not-allowed" : ""}`}
                  />
                </div>
                {formErr.email && <p className="text-red-400 text-xs mt-1">{formErr.email}</p>}
                {editingId && <p className="text-gray-500 text-xs mt-1">Email tidak dapat diubah</p>}
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Password {editingId ? "" : <span className="text-red-400">*</span>}
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    placeholder={editingId ? "Kosongkan jika tidak diubah" : "Minimal 6 karakter"}
                    className={`w-full pl-10 pr-12 py-2.5 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm ${
                      formErr.password ? "border-red-500" : "border-gray-700"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {formErr.password && <p className="text-red-400 text-xs mt-1">{formErr.password}</p>}
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Role <span className="text-red-400">*</span>
                </label>
                <select
                  value={form.role}
                  onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm"
                >
                  <option value="ADMIN">Admin</option>
                  <option value="CUSTOMER">Customer</option>
                </select>
                <p className="text-gray-500 text-xs mt-1">
                  {form.role === "ADMIN" ? "Akses penuh ke panel admin" : "Hanya dapat melakukan pembelian"}
                </p>
              </div>

              {/* Discord */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Discord</label>
                <input
                  type="text"
                  value={form.discord}
                  onChange={e => setForm(p => ({ ...p, discord: e.target.value }))}
                  placeholder="username#0000"
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Telepon</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                  placeholder="08xxxxxxxxxx"
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm"
                />
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-900 border-t border-gray-800 px-6 py-4 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2.5 text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg flex items-center gap-2 shadow-lg shadow-blue-600/20"
              >
                {saving ? (
                  <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Menyimpan...</>
                ) : (
                  <><Check className="h-4 w-4" /> {editingId ? "Simpan" : "Buat Admin"}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Deactivate Confirmation ── */}
      {delTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDelTarget(null)} />
          <div className="relative w-full max-w-md bg-gray-900 border border-gray-800 rounded-xl shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Nonaktifkan User</h3>
                <p className="text-sm text-gray-400">User tidak akan bisa login</p>
              </div>
            </div>
            <p className="text-gray-300 text-sm mb-6">
              Nonaktifkan <span className="text-white font-medium">&quot;{delTarget.name}&quot;</span> ({delTarget.email})?
              {delTarget.role === "ADMIN" && (
                <span className="block mt-2 text-yellow-400 text-xs">
                  ⚠️ User ini adalah admin. Pastikan masih ada admin aktif lainnya.
                </span>
              )}
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDelTarget(null)}
                disabled={deleting}
                className="px-4 py-2.5 text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg"
              >
                Batal
              </button>
              <button
                onClick={handleDeactivate}
                disabled={deleting}
                className="px-6 py-2.5 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg flex items-center gap-2"
              >
                {deleting ? (
                  <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Menonaktifkan...</>
                ) : (
                  <><Trash2 className="h-4 w-4" /> Ya, Nonaktifkan</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
