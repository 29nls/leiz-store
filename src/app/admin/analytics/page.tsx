"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { SlideUp } from "@/components/ui/animated";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Package,
  Users,
  RefreshCw,
  Calendar,
} from "@/components/ui/icons";
import { cn, formatPrice } from "@/lib/utils";

interface DashboardData {
  overview: {
    totalRevenue: number;
    totalRevenueUSD: number;
    totalOrders: number;
    revenueChange: number;
    ordersChange: number;
    totalProducts: number;
    lowStockCount: number;
    totalCustomers: number;
    newCustomers: number;
  };
  charts: {
    dailyRevenue: Array<{ date: string; revenue: number; orders: number }>;
    paymentMethods: Array<{ method: string; count: number }>;
    topProducts: Array<{ productId: string; name: string; revenue: number; orders: number }>;
  };
  events: Record<string, number>;
}

const fadeInUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.32, 0.72, 0, 1] },
};

export default function AnalyticsPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  async function fetchAnalytics() {
    setLoading(true);
    try {
      const now = new Date();
      const daysMap = { "7d": 7, "30d": 30, "90d": 90 };
      const days = daysMap[period];
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
      const endDate = now.toISOString();
      const res = await fetch(`/api/admin/analytics?startDate=${startDate}&endDate=${endDate}`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
    } finally {
      setLoading(false);
    }
  }

  const stats = data
    ? [
        {
          label: "Total Revenue",
          value: formatPrice(data.overview.totalRevenue),
          change: data.overview.revenueChange,
          icon: DollarSign,
          color: "text-success",
          gradient: "from-success/20 to-success/5",
        },
        {
          label: "Total Orders",
          value: data.overview.totalOrders.toLocaleString(),
          change: data.overview.ordersChange,
          icon: ShoppingCart,
          color: "text-primary",
          gradient: "from-primary/20 to-primary/5",
        },
        {
          label: "Customers",
          value: data.overview.totalCustomers.toLocaleString(),
          icon: Users,
          color: "text-accent",
          gradient: "from-accent/20 to-accent/5",
        },
        {
          label: "Products",
          value: String(data.overview.totalProducts),
          icon: Package,
          color: "text-warning",
          gradient: "from-warning/20 to-warning/5",
        },
      ]
    : [];

  const maxRevenue = data
    ? Math.max(...data.charts.dailyRevenue.map((d) => d.revenue), 1)
    : 1;

  return (
    <div className="space-y-8">
      {/* Header */}
      <SlideUp
        delay={0}
        duration={0.5}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-text">Analytics Dashboard</h1>
          <p className="text-sm text-text-muted/60 mt-1">Track your store performance</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-white/10 bg-surface/40 p-1">
            {(["7d", "30d", "90d"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  period === p
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "text-text-muted hover:text-text"
                )}
              >
                {p === "7d" ? "7 Days" : p === "30d" ? "30 Days" : "90 Days"}
              </button>
            ))}
          </div>
          <button
            onClick={fetchAnalytics}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-surface/40 text-text-muted hover:text-text transition-all"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>
      </SlideUp>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <SlideUp
            key={stat.label}
            delay={i * 0.08}
            duration={0.5}
            className="card-premium p-5 group"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-text-muted/60 uppercase tracking-wider">
                  {stat.label}
                </p>
                <p className="text-2xl font-bold text-text mt-2">{stat.value}</p>
                {stat.change !== undefined && (
                  <div
                    className={cn(
                      "flex items-center gap-1 mt-1.5 text-xs font-medium",
                      stat.change >= 0 ? "text-success" : "text-danger"
                    )}
                  >
                    {stat.change >= 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {stat.change >= 0 ? "+" : ""}
                    {stat.change.toFixed(1)}%
                  </div>
                )}
              </div>
              <div
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br",
                  stat.gradient,
                  stat.color
                )}
              >
                <stat.icon className="h-5 w-5" />
              </div>
            </div>
          </SlideUp>
        ))}
      </div>

      {/* Revenue Chart */}
      <SlideUp
        delay={0.35}
        duration={0.5}
        className="card-premium overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
          <h2 className="text-lg font-semibold text-text">Revenue Overview</h2>
          <div className="flex items-center gap-2 text-xs text-text-muted/60">
            <Calendar className="h-3.5 w-3.5" />
            Last {period}
          </div>
        </div>
        <div className="p-6">
          {data && data.charts.dailyRevenue.length > 0 ? (
            <div className="flex items-end gap-1 h-48">
              {data.charts.dailyRevenue.slice(-30).map((day, i) => (
                <div
                  key={day.date}
                  className="flex-1 group relative"
                  style={{ height: `${Math.max((day.revenue / maxRevenue) * 100, 2)}%` }}
                >
                  <div className="w-full h-full rounded-t-sm bg-gradient-to-t from-primary/60 to-primary/20 hover:from-primary hover:to-primary/60 transition-all duration-300" />
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block z-10">
                    <div className="glass-strong rounded-lg px-2 py-1 text-[10px] text-text whitespace-nowrap shadow-lg">
                      {new Date(day.date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}: {formatPrice(day.revenue)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-sm text-text-muted/40">
              No revenue data available
            </div>
          )}
        </div>
      </SlideUp>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <SlideUp
          delay={0.4}
          duration={0.5}
          className="card-premium overflow-hidden"
        >
          <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
            <h2 className="text-lg font-semibold text-text">Top Products</h2>
          </div>
          <div className="divide-y divide-white/5">
            {data?.charts.topProducts.slice(0, 5).map((product, i) => (
              <div
                key={product.productId}
                className="flex items-center gap-4 px-6 py-4 hover:bg-surface/30 transition-colors"
              >
                <span className="text-xs font-bold text-text-muted/40 w-5">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text truncate">{product.name}</p>
                  <p className="text-xs text-text-muted/60">{product.orders} orders</p>
                </div>
                <p className="text-sm font-semibold text-text">{formatPrice(product.revenue)}</p>
              </div>
            ))}
            {(!data?.charts.topProducts || data.charts.topProducts.length === 0) && (
              <div className="px-6 py-12 text-center text-sm text-text-muted/40">
                No product data yet
              </div>
            )}
          </div>
        </SlideUp>

        {/* Payment Methods */}
        <SlideUp
          delay={0.45}
          duration={0.5}
          className="card-premium overflow-hidden"
        >
          <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
            <h2 className="text-lg font-semibold text-text">Payment Methods</h2>
          </div>
          <div className="p-6 space-y-4">
            {data?.charts.paymentMethods.map((pm) => {
              const total = data.charts.paymentMethods.reduce((s, p) => s + p.count, 0);
              const pct = total > 0 ? (pm.count / total) * 100 : 0;
              return (
                <div key={pm.method} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-text capitalize">
                      {pm.method?.replace("_", " ") || "Unknown"}
                    </span>
                    <span className="text-sm text-text-muted/60">
                      {pm.count} ({pct.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-surface/60 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
                    />
                  </div>
                </div>
              );
            })}
            {(!data?.charts.paymentMethods || data.charts.paymentMethods.length === 0) && (
              <div className="text-center py-8 text-sm text-text-muted/40">
                No payment data yet
              </div>
            )}
          </div>
        </SlideUp>
      </div>

      {/* Event Metrics */}
      {data?.events && Object.keys(data.events).length > 0 && (
        <SlideUp
          delay={0.5}
          duration={0.5}
          className="card-premium overflow-hidden"
        >
          <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
            <h2 className="text-lg font-semibold text-text">Event Metrics</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-6">
            {Object.entries(data.events).map(([event, count]) => (
              <div key={event} className="text-center">
                <p className="text-2xl font-bold text-text">{count.toLocaleString()}</p>
                <p className="text-xs text-text-muted/60 mt-1 capitalize">
                  {event.replace(/_/g, " ")}
                </p>
              </div>
            ))}
          </div>
        </SlideUp>
      )}
    </div>
  );
}
