"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import {
  LayoutDashboard,
  Package,
  FolderTree,
  ShoppingCart,
  Settings,
  Users,
  FileText,
  LogOut,
  Menu,
  X,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/products", label: "Produk", icon: Package },
  { href: "/admin/categories", label: "Kategori", icon: FolderTree },
  { href: "/admin/orders", label: "Pesanan", icon: ShoppingCart },
  { href: "/admin/invoices", label: "Invoice", icon: FileText },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/settings", label: "Pengaturan", icon: Settings },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminName, setAdminName] = useState("Admin");
  const [connectionStatus, setConnectionStatus] = useState<"checking" | "connected" | "error">("checking");

  const isLoginPage = pathname === "/admin/login";

  const checkAuth = useCallback(async () => {
    try {
      // Check Supabase session first
      const supabase = getSupabaseBrowser();
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        setAuthenticated(true);
        setAdminName(session.user.email?.split("@")[0] || "Admin");
        setConnectionStatus("connected");
        setLoading(false);
        return true;
      }

      // Fallback: check JWT cookie via API
      const res = await fetch("/api/admin/verify");
      if (res.ok) {
        const data = await res.json();
        setAuthenticated(true);
        setAdminName(data.user?.email?.split("@")[0] || "Admin");
        setConnectionStatus("connected");
        setLoading(false);
        return true;
      }

      // Not authenticated
      setConnectionStatus("error");
      router.replace("/admin/login");
      return false;
    } catch {
      setConnectionStatus("error");
      router.replace("/admin/login");
      return false;
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (isLoginPage) {
      setLoading(false);
      return;
    }

    checkAuth();

    // Listen for auth state changes
    const supabase = getSupabaseBrowser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        router.replace("/admin/login");
      } else if (event === "SIGNED_IN" && session) {
        setAuthenticated(true);
        setAdminName(session.user.email?.split("@")[0] || "Admin");
        setConnectionStatus("connected");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isLoginPage, router, checkAuth]);

  // Close sidebar on Escape key
  useEffect(() => {
    if (!sidebarOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [sidebarOpen]);

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  async function handleLogout() {
    try {
      // Sign out from Supabase Auth
      const supabase = getSupabaseBrowser();
      await supabase.auth.signOut();
    } catch {
      // Ignore errors
    }

    // Also clear server-side JWT cookie
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
  }

  // Login page: render without shell
  if (isLoginPage) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-void">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ember" />
          <p className="text-text-secondary text-sm animate-pulse">Memuat panel admin...</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-void text-text-primary flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-64 bg-surface-raised backdrop-blur-sm border-r border-border
          transform transition-transform duration-200 ease-in-out
          lg:translate-x-0 lg:static lg:z-auto
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-ember flex items-center justify-center text-void font-bold text-sm">
              L
            </div>
            <span className="text-lg font-bold text-text-primary">Leiz Admin</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-text-secondary hover:text-text-primary transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex flex-col gap-1 p-4">
          {navItems.map((item) => {
            const active = pathname === item.href ||
              (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium
                  transition-all duration-150
                  ${active
                    ? "bg-arcane/15 text-arcane border border-arcane/25 shadow-lg shadow-arcane/10"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-raised"
                  }
                `}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </a>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border bg-surface-raised">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-sm font-medium
                       text-text-secondary hover:text-error hover:bg-error/10 transition-all duration-150"
          >
            <LogOut className="h-5 w-5" />
            Keluar
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 flex items-center justify-between gap-4 px-6 border-b border-border bg-surface-raised backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-text-secondary hover:text-text-primary transition-colors"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-sm text-text-secondary">
                Halo, <span className="text-text-primary font-medium">{adminName}</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {connectionStatus === "error" && (
              <button
                onClick={checkAuth}
                className="text-xs text-error hover:text-error flex items-center gap-1 px-2 py-1 rounded bg-error/10"
              >
                <AlertTriangle className="h-3 w-3" />
                Koneksi error
                <RefreshCw className="h-3 w-3 ml-1" />
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
