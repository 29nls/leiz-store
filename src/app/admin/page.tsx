"use client";

import { SlideUp } from "@/components/ui/animated";
import {
  DollarSign,
  ShoppingCart,
  Package,
  AlertTriangle,
  Download,
  Plus,
  Loader2,
  TrendingUp,
  TrendingDown,
  Users,
} from "@/components/ui/icons";
import { formatPrice, cn } from "@/lib/utils";
import { useAdminDashboard } from "@/hooks/use-data";

const statusStyles: Record<string, string> = {
  completed: "bg-success/15 text-success",
  paid: "bg-primary/15 text-primary",
  processing: "bg-warning/15 text-warning",
  waiting_payment: "bg-accent/15 text-accent",
  pending: "bg-surface-light/50 text-text-muted",
};

const statusLabels: Record<string, string> = {
  completed: "Completed",
  paid: "Paid",
  processing: "Processing",
  waiting_payment: "Waiting",
  pending: "Pending",
};

export default function AdminDashboardPage() {
  const { data, loading, error } = useAdminDashboard();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-text-muted/60">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-danger">Failed to load dashboard: {error}</p>
      </div>
    );
  }

  const overview = data?.overview;
  const stats = [
    {
      label: "Total Revenue",
      value: formatPrice(overview?.totalRevenue || 0),
      change: overview?.revenueChange,
      icon: DollarSign,
      color: "text-success",
      gradient: "from-success/20 to-success/5",
    },
    {
      label: "Total Orders",
      value: (overview?.totalOrders || 0).toLocaleString(),
      change: overview?.ordersChange,
      icon: ShoppingCart,
      color: "text-primary",
      gradient: "from-primary/20 to-primary/5",
    },
    {
      label: "Total Products",
      value: String(overview?.totalProducts || 0),
      icon: Package,
      color: "text-accent",
      gradient: "from-accent/20 to-accent/5",
    },
    {
      label: "Low Stock Alert",
      value: String(overview?.lowStockCount || 0),
      icon: AlertTriangle,
      color: overview?.lowStockCount ? "text-warning" : "text-success",
      gradient: overview?.lowStockCount ? "from-warning/20 to-warning/5" : "from-success/20 to-success/5",
    },
  ];

  const recentOrders = data?.charts?.topProducts?.slice(0, 5) || [];

  return (
    <div className="space-y-8">
      <SlideUp
        delay={0}
        duration={0.5}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-text">Dashboard</h1>
          <p className="text-sm text-text-muted/60 mt-1">Welcome back, Admin</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-text-muted hover:text-text hover:bg-surface/40 transition-all duration-300">
            <Download className="h-4 w-4" />
            Export
          </button>
          <button className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 hover:bg-primary-light transition-all duration-300">
            <Plus className="h-4 w-4" />
            Add Product
          </button>
        </div>
      </SlideUp>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
        {stats.map((stat, i) => (
          <SlideUp
            key={stat.label}
            delay={i * 0.08}
            duration={0.5}
            className="card-premium p-5 lg:p-6 group"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-text-muted/60 uppercase tracking-wider">{stat.label}</p>
                <p className="text-2xl font-bold text-text mt-2">{stat.value}</p>
                {stat.change !== undefined && (
                  <div className={cn("flex items-center gap-1 mt-1.5 text-xs font-medium", stat.color)}>
                    {stat.change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {stat.change >= 0 ? "+" : ""}{stat.change.toFixed(1)}%
                  </div>
                )}
              </div>
              <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br", stat.gradient, stat.color)}>
                <stat.icon className="h-5 w-5" />
              </div>
            </div>
          </SlideUp>
        ))}
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SlideUp
          delay={0.35}
          duration={0.5}
          className="card-premium p-5 flex items-center gap-4"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-text">{overview?.totalCustomers || 0}</p>
            <p className="text-xs text-text-muted/60">Total Customers</p>
          </div>
        </SlideUp>
        <SlideUp
          delay={0.4}
          duration={0.5}
          className="card-premium p-5 flex items-center gap-4"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-text">{overview?.newCustomers || 0}</p>
            <p className="text-xs text-text-muted/60">New This Month</p>
          </div>
        </SlideUp>
        <SlideUp
          delay={0.45}
          duration={0.5}
          className="card-premium p-5 flex items-center gap-4"
        >
          <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl", overview?.lowStockCount ? "bg-warning/10 text-warning" : "bg-success/10 text-success")}>
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-text">{overview?.lowStockCount || 0}</p>
            <p className="text-xs text-text-muted/60">Low Stock Items</p>
          </div>
        </SlideUp>
      </div>

      {/* Top Products Table */}
      <SlideUp
        delay={0.5}
        duration={0.5}
        className="card-premium overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
          <h2 className="text-lg font-semibold text-text">Top Products</h2>
          <button className="text-sm text-primary hover:text-primary-light font-medium transition-colors duration-300">
            View All
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left text-[11px] font-semibold text-text-muted/50 uppercase tracking-wider px-6 py-3">Product</th>
                <th className="text-right text-[11px] font-semibold text-text-muted/50 uppercase tracking-wider px-6 py-3">Revenue</th>
                <th className="text-right text-[11px] font-semibold text-text-muted/50 uppercase tracking-wider px-6 py-3">Orders</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {recentOrders.map((product) => (
                <tr key={product.productId} className="hover:bg-surface/30 transition-colors duration-200">
                  <td className="px-6 py-4 text-sm font-medium text-text">{product.name}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-text text-right">{formatPrice(product.revenue)}</td>
                  <td className="px-6 py-4 text-sm text-text-muted/60 text-right">{product.orders}</td>
                </tr>
              ))}
              {recentOrders.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-sm text-text-muted/40">
                    No product data yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SlideUp>
    </div>
  );
}
