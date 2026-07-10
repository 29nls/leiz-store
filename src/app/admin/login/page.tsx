"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, Eye, EyeOff } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Client-side validation
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Email wajib diisi");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Format email tidak valid");
      return;
    }
    if (!password) {
      setError("Password wajib diisi");
      return;
    }
    if (password.length < 6) {
      setError("Password minimal 6 karakter");
      return;
    }

    setLoading(true);

    try {
      const supabase = getSupabaseBrowser();

      // Step 1: Sign in with Supabase Auth
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (signInError) {
        if (signInError.message.includes("Invalid login credentials")) {
          setError("Email atau password salah");
        } else if (signInError.message.includes("Email not confirmed")) {
          setError("Email belum dikonfirmasi. Silakan cek inbox Anda.");
        } else {
          setError(signInError.message);
        }
        return;
      }

      if (!data.session) {
        setError("Gagal mendapatkan sesi. Coba lagi.");
        return;
      }

      // Step 2: Verify admin role via direct Supabase query (no API route needed)
      const { data: userData, error: userError } = await supabase
        .from("user")
        .select("role, name")
        .eq("email", trimmedEmail)
        .single();

      if (userError || !userData) {
        // If user record not found in public.user table, sign out and show error
        await supabase.auth.signOut();
        setError("Akun tidak ditemukan di sistem. Hubungi administrator.");
        return;
      }

      if (userData.role !== "ADMIN") {
        await supabase.auth.signOut();
        setError("Akses ditolak. Hanya admin yang dapat masuk.");
        return;
      }

      // Step 3: Also set JWT cookie for server-side API routes (non-blocking)
      fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, password }),
      }).catch(() => { /* Non-critical: cookie sync failure is acceptable */ });

      router.replace("/admin");
    } catch (err: any) {
      // Handle network errors gracefully
      if (err?.message?.includes("Failed to fetch") || err?.name === "TypeError") {
        setError("Gagal terhubung ke server. Periksa koneksi internet Anda.");
      } else {
        setError(err.message || "Terjadi kesalahan yang tidak terduga. Coba lagi.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-void px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-arcane/15 mb-4 ring-1 ring-arcane/25">
            <Lock className="h-8 w-8 text-arcane" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">Admin Panel</h1>
          <p className="text-text-secondary mt-1">Leiz Store Management</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-surface backdrop-blur-sm border border-border rounded-xl p-6 space-y-5 shadow-xl"
        >
          {error && (
            <div className="bg-error/10 border border-error/30 text-error px-4 py-3 rounded-lg text-sm flex items-start gap-2">
              <span className="mt-0.5">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-tertiary" />
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (error) setError(""); }}
                placeholder="admin@leizstore.com"
                required
                autoComplete="email"
                disabled={loading}
                className="w-full pl-10 pr-4 py-3 bg-surface-raised border border-border rounded-lg
                           text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2
                           focus:ring-arcane focus:border-transparent transition-all duration-200
                           disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-tertiary" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (error) setError(""); }}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                disabled={loading}
                className="w-full pl-10 pr-12 py-3 bg-surface-raised border border-border rounded-lg
                           text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2
                           focus:ring-arcane focus:border-transparent transition-all duration-200
                           disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-ember hover:bg-ember-bright 
                       disabled:bg-surface-raised disabled:text-text-tertiary disabled:cursor-not-allowed text-void font-semibold 
                       rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-ember/20"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-void" />
                Memproses...
              </>
            ) : (
              "Masuk ke Admin"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
