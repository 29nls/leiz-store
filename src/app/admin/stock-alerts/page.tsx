"use client";

import { useState, useEffect } from "react";
import { SlideUp } from "@/components/ui/animated";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Package,
  Bell,
  ExternalLink,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface StockAlert {
  id: string;
  productId: string;
  type: string;
  threshold: number;
  currentStock: number;
  isRead: boolean;
  isSent: boolean;
  sentVia: string | null;
  createdAt: string;
}

export default function StockAlertsPage() {
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    fetchAlerts();
  }, []);

  async function fetchAlerts() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/stock-alerts");
      const json = await res.json();
      if (json.success) setAlerts(json.data.items || []);
    } catch (err) {
      console.error("Failed to fetch alerts:", err);
    } finally {
      setLoading(false);
    }
  }

  async function checkAlerts() {
    setChecking(true);
    try {
      await fetch("/api/admin/stock-alerts", { method: "POST" });
      await fetchAlerts();
    } catch (err) {
      console.error("Failed to check alerts:", err);
    } finally {
      setChecking(false);
    }
  }

  async function markAsRead(id: string) {
    try {
      await fetch(`/api/admin/stock-alerts/${id}/read`, { method: "PATCH" });
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error("Failed to mark as read:", err);
    }
  }

  const unreadAlerts = alerts.filter((a) => !a.isRead);
  const outOfStock = alerts.filter((a) => a.type === "OUT_OF_STOCK");

  return (
    <div className="space-y-8">
      {/* Header */}
      <SlideUp
        delay={0}
        duration={0.5}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-text">Stock Alerts</h1>
          <p className="text-sm text-text-muted/60 mt-1">
            Monitor low stock and out-of-stock products
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={checkAlerts}
            disabled={checking}
            className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-text-muted hover:text-text hover:bg-surface/40 transition-all disabled:opacity-50"
          >
            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {checking ? "Checking..." : "Check Stock"}
          </button>
        </div>
      </SlideUp>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SlideUp
          delay={0.1}
          duration={0.5}
          className="card-premium p-5 flex items-center gap-4"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-danger/10 text-danger">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-text">{unreadAlerts.length}</p>
            <p className="text-xs text-text-muted/60">Active Alerts</p>
          </div>
        </SlideUp>
        <SlideUp
          delay={0.15}
          duration={0.5}
          className="card-premium p-5 flex items-center gap-4"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-danger/15 text-danger">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-text">{outOfStock.length}</p>
            <p className="text-xs text-text-muted/60">Out of Stock</p>
          </div>
        </SlideUp>
        <SlideUp
          delay={0.2}
          duration={0.5}
          className="card-premium p-5 flex items-center gap-4"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success/10 text-success">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-text">{alerts.length - unreadAlerts.length}</p>
            <p className="text-xs text-text-muted/60">Resolved</p>
          </div>
        </SlideUp>
      </div>

      {/* Alert List */}
      <SlideUp
        delay={0.25}
        duration={0.5}
        className="card-premium overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
          <h2 className="text-lg font-semibold text-text">All Alerts</h2>
          <button
            onClick={() => {
              unreadAlerts.forEach((a) => markAsRead(a.id));
            }}
            className="text-sm text-primary hover:text-primary-light font-medium transition-colors"
          >
            Mark All Read
          </button>
        </div>
        <div className="divide-y divide-white/5">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={cn(
                "flex items-center gap-4 px-6 py-4 transition-colors hover:bg-surface/30",
                !alert.isRead && "bg-primary/5"
              )}
            >
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl flex-shrink-0",
                  alert.type === "OUT_OF_STOCK"
                    ? "bg-danger/15 text-danger"
                    : "bg-warning/15 text-warning"
                )}
              >
                {alert.type === "OUT_OF_STOCK" ? (
                  <Package className="h-5 w-5" />
                ) : (
                  <AlertTriangle className="h-5 w-5" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text">
                  {alert.type === "OUT_OF_STOCK" ? "Out of Stock" : "Low Stock"} — Product{" "}
                  <span className="text-primary">{alert.productId.slice(0, 8)}</span>
                </p>
                <p className="text-xs text-text-muted/60 mt-0.5">
                  Current: {alert.currentStock} | Threshold: {alert.threshold}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {alert.isSent && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-medium text-success">
                    <Bell className="h-2.5 w-2.5" /> Sent
                  </span>
                )}
                {!alert.isRead && (
                  <button
                    onClick={() => markAsRead(alert.id)}
                    className="text-xs text-primary hover:text-primary-light font-medium transition-colors"
                  >
                    Dismiss
                  </button>
                )}
              </div>
            </div>
          ))}
          {alerts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-sm text-text-muted/40">
              <CheckCircle2 className="h-12 w-12 mb-4 opacity-20" />
              <p>No stock alerts</p>
              <p className="text-xs mt-1">All products are well-stocked</p>
            </div>
          )}
        </div>
      </SlideUp>
    </div>
  );
}
