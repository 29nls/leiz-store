"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Package, FolderTree, ShoppingCart, Clock, AlertTriangle,
  TrendingUp, RefreshCw, DollarSign,
} from "lucide-react";
import { getSupabaseBrowser, subscribeToTable } from "@/lib/supabase-browser";
import Link from "next/link";

interface Stats {
  totalProducts: number;
  activeProducts: number;
  totalCategories: number;
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  totalRevenue: number;
}

interface RecentOrder {
  id: string;
  order_number: string;
  customer_name: string;
  total: number;
  status: string;
  created_at: string;
}

interface LowStockProduct {
  id: string;
  name: string;
  slug: string;
  stock: number;
  min_stock: number;
}

function fmtIDR(n: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency", currency: "IDR", minimumFractionDigits: 0,
  }).format(n);
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [lowStock, setLowStock] = useState<LowStockProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const supabase = getSupabaseBrowser();

      // Parallel queries for all stats
      const [
        productsRes,
        activeProductsRes,
        categoriesRes,
        ordersRes,
        pendingRes,
        completedRes,
        revenueRes,
        recentRes,
        lowStockRes,
      ] = await Promise.all([
        supabase.from("product").select("id", { count: "exact", head: true }),
        supabase.from("product").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("category").select("id", { count: "exact", head: true }),
        supabase.from("order").select("id", { count: "exact", head: true }),
        supabase.from("order").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
        supabase.from("order").select("id", { count: "exact", head: true }).eq("status", "COMPLETED"),
        supabase.from("order").select("total").eq("status", "COMPLETED"),
        supabase.from("order")
          .select("id,order_number,customer_name,total,status,created_at")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase.from("product")
          .select("id,name,slug,stock,min_stock")
          .lte("stock", 10)
          .order("stock", { ascending: true })
          .limit(10),
      ]);

      // Check for any errors
      const errors = [
        productsRes.error, activeProductsRes.error, categoriesRes.error,
        ordersRes.error, pendingRes.error, completedRes.error,
      ].filter(Boolean);
      if (errors.length > 0) {
        throw new Error(errors[0]!.message);
      }

      // Calculate total revenue from completed orders
      const totalRevenue = (revenueRes.data || []).reduce(
        (sum, o) => sum + (o.total || 0), 0
      );

      // Filter low stock products client-side (stock <= min_stock)
      const lowStockProducts = (lowStockRes.data || []).filter(
        (p) => p.stock <= p.min_stock
      );

      setStats({
        totalProducts: productsRes.count || 0,
        activeProducts: activeProductsRes.count || 0,
        totalCategories: categoriesRes.count || 0,
        totalOrders: ordersRes.count || 0,
        pendingOrders: pendingRes.count || 0,
        completedOrders: completedRes.count || 0,
        totalRevenue,
      });
      setRecentOrders((recentRes.data || []) as RecentOrder[]);
      setLowStock(lowStockProducts as LowStockProduct[]);
    } catch (err: any) {
      setError(err.message || "Gagal memuat data dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Real-time subscriptions for live updates
  useEffect(() => {
    const unsubs = [
      subscribeToTable("order", () => fetchData(true)),
      subscribeToTable("product", () => fetchData(true)),
    ];
    return () => { unsubs.forEach((u) => u()); };
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
          <p className="text-gray-400 text-sm">Memuat dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
          <button onClick={() => fetchData()} className="ml-auto hover:text-red-300">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      label: "Total Produk",
      value: stats?.totalProducts || 0,
      sub: `${stats?.activeProducts || 0} aktif`,
      icon: Package,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
      href: "/admin/products",
    },
    {
      label: "Total Kategori",
      value: stats?.totalCategories || 0,
      icon: FolderTree,
      color: "text-green-400",
      bg: "bg-green-500/10",
      border: "border-green-500/20",
      href: "/admin/categories",
    },
    {
      label: "Total Pesanan",
      value: stats?.totalOrders || 0,
      sub: `${stats?.completedOrders || 0} selesai`,
      icon: ShoppingCart,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
      border: "border-purple-500/20",
      href: "/admin/orders",
    },
    {
      label: "Pesanan Pending",
      value: stats?.pendingOrders || 0,
      icon: Clock,
      color: "text-yellow-400",
      bg: "bg-yellow-500/10",
      border: "border-yellow-500/20",
      href: "/admin/orders",
    },
    {
      label: "Total Pendapatan",
      value: fmtIDR(stats?.totalRevenue || 0),
      icon: DollarSign,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
      href: "/admin/orders",
    },
  ];

  const statusColor = (s: string) => {
    switch (s) {
      case "PENDING": return "bg-yellow-500/20 text-yellow-400";
      case "WAITING_PAYMENT": return "bg-orange-500/20 text-orange-400";
      case "PAID": return "bg-blue-500/20 text-blue-400";
      case "PROCESSING": return "bg-purple-500/20 text-purple-400";
      case "COMPLETED": return "bg-green-500/20 text-green-400";
      case "CANCELLED": return "bg-red-500/20 text-red-400";
      default: return "bg-gray-500/20 text-gray-400";
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 mt-1">Ringkasan toko Anda</p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {statCards.map((card) => (
           <Link
               key={card.label}
               href={card.href}
               className={`${card.bg} border ${card.border} rounded-xl p-5 hover:scale-[1.02] transition-all duration-200 group`}
             >
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-400">{card.label}</p>
              <card.icon className={`h-5 w-5 ${card.color} opacity-60 group-hover:opacity-100 transition-opacity`} />
            </div>
            <p className={`text-2xl font-bold ${card.color}`}>
              {typeof card.value === "number" ? card.value.toLocaleString("id-ID") : card.value}
            </p>
            {card.sub && <p className="text-xs text-gray-500 mt-1">{card.sub}</p>}
           </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Pesanan Terbaru</h2>
            <Link href="/admin/orders" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
              Lihat semua →
             </Link>
          </div>

          {recentOrders.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-gray-500">
              <ShoppingCart className="h-8 w-8 opacity-30" />
              <p className="text-sm">Belum ada pesanan</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentOrders.map((order) => (
<Link
                   key={order.id}
                   href="/admin/orders"
                   className="flex items-center justify-between p-3 rounded-lg bg-gray-800/30 hover:bg-gray-800/60 transition-colors group"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">#{order.order_number}</p>
                    <p className="text-xs text-gray-400 truncate">{order.customer_name}</p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className="text-sm font-medium text-white">{fmtIDR(order.total)}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColor(order.status)}`}>
                      {order.status.replace("_", " ")}
                    </span>
                  </div>
            </Link>
              ))}
            </div>
          )}
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Stok Menipis</h2>
            <Link href="/admin/products" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
               Ke produk →
             </Link>
          </div>

          {lowStock.length === 0 ? (
            <div className="flex items-center gap-2 text-green-400 text-sm py-8 justify-center">
              <TrendingUp className="h-5 w-5" />
              Semua stok aman
            </div>
          ) : (
            <div className="space-y-2">
              {lowStock.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/10"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{product.name}</p>
                      <p className="text-xs text-gray-500">Min: {product.min_stock}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-bold flex-shrink-0 ml-3 ${
                    product.stock <= 0 ? "text-red-400" : "text-yellow-400"
                  }`}>
                    {product.stock}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
