"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  BarChart3,
  Settings,
  AlertTriangle,
  Bell,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Store,
  Boxes,
  Activity,
  Menu,
  X,
  LogOut,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { logout as authLogout, getCurrentUser, getAuthUser } from "@/middleware/auth";

const sidebarLinks = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/forecast", label: "Forecasting", icon: TrendingUp },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/categories", label: "Categories", icon: Boxes },
  { href: "/admin/stock-alerts", label: "Stock Alerts", icon: AlertTriangle },
  { href: "/admin/activity", label: "Activity Logs", icon: Activity },
  { href: "/admin/notifications", label: "Notifications", icon: Bell },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const pathname = usePathname();
  const router = useRouter();

  // Check authentication
  useEffect(() => {
    // Skip auth check for login page
    if (pathname === "/admin/login") {
      setLoading(false);
      return;
    }

    const checkAuth = async () => {
      const currentUser = await getCurrentUser();
      if (currentUser) {
        setIsAuthenticated(true);
        setUser(currentUser);
      } else {
        router.push("/admin/login");
      }
      setLoading(false);
    };

    checkAuth();
  }, [pathname, router]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Update user from localStorage
  useEffect(() => {
    if (isAuthenticated && !user) {
      setUser(getAuthUser());
    }
  }, [isAuthenticated, user]);

  const handleLogout = async () => {
    await authLogout();
    router.push("/admin/login");
    router.refresh();
  };

  // Don't render admin layout for login page
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // If not authenticated, don't render (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col border-r border-white/5 bg-surface/30 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
          collapsed ? "w-[72px]" : "w-64"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-white/5">
          <Link href="/admin" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary text-white font-bold text-sm shadow-lg shadow-primary/20 flex-shrink-0">
              LZ
            </div>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm font-bold tracking-tight"
              >
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  LEIZ
                </span>
                <span className="text-text/60 ml-1 font-normal">Admin</span>
              </motion.span>
            )}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {sidebarLinks.map((link) => {
            const isActive =
              pathname === link.href ||
              (link.href !== "/admin" && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-300 group",
                  isActive
                    ? "bg-primary/15 text-primary border border-primary/20"
                    : "text-text-muted hover:text-text hover:bg-surface/60"
                )}
                title={collapsed ? link.label : undefined}
              >
                <link.icon
                  className={cn(
                    "h-[18px] w-[18px] flex-shrink-0",
                    isActive ? "text-primary" : "text-text-muted/60 group-hover:text-text-muted"
                  )}
                />
                {!collapsed && <span>{link.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className="border-t border-white/5 p-3 space-y-1">
          {user && (
            <div className="px-3 py-2 mb-2">
              <p className="text-xs text-text-muted truncate">
                Logged in as
              </p>
              <p className="text-sm font-medium text-text truncate">
                {user.name || user.username}
              </p>
            </div>
          )}
          <Link
            href="/"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-text-muted hover:text-text hover:bg-surface/60 transition-all"
          >
            <Store className="h-[18px] w-[18px] flex-shrink-0" />
            {!collapsed && <span>Back to Store</span>}
          </Link>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-danger/80 hover:text-danger hover:bg-danger/10 transition-all"
          >
            <LogOut className="h-[18px] w-[18px] flex-shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-text-muted hover:text-text hover:bg-surface/60 transition-all"
          >
            {collapsed ? (
              <ChevronRight className="h-[18px] w-[18px] flex-shrink-0" />
            ) : (
              <>
                <ChevronLeft className="h-[18px] w-[18px] flex-shrink-0" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 lg:hidden"
          >
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              className="absolute left-0 top-0 bottom-0 w-72 bg-surface border-r border-white/5"
            >
              <div className="flex items-center justify-between px-4 h-16 border-b border-white/5">
                <span className="text-sm font-semibold text-text">Admin Menu</span>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="text-text-muted hover:text-text"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="py-4 px-3 space-y-1">
                {sidebarLinks.map((link) => {
                  const isActive =
                    pathname === link.href ||
                    (link.href !== "/admin" && pathname.startsWith(link.href));
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                        isActive
                          ? "bg-primary/15 text-primary border border-primary/20"
                          : "text-text-muted hover:text-text hover:bg-surface/60"
                      )}
                    >
                      <link.icon className="h-[18px] w-[18px] flex-shrink-0" />
                      <span>{link.label}</span>
                    </Link>
                  );
                })}
              </nav>
              
              {/* Mobile Logout */}
              <div className="px-3 pb-4 space-y-1 border-t border-white/5 pt-4">
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-danger/80 hover:text-danger hover:bg-danger/10 transition-all"
                >
                  <LogOut className="h-[18px] w-[18px] flex-shrink-0" />
                  <span>Logout</span>
                </button>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center gap-3 h-14 px-4 border-b border-white/5 bg-surface/30 sticky top-0 z-30">
          <button
            onClick={() => setMobileOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-text-muted hover:text-text hover:bg-surface/60 transition-all"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold text-text">Admin Dashboard</span>
        </div>

        <div className="p-4 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
