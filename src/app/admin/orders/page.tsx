"use client";

import { useState } from "react";
import { Search, Eye, Download, Loader2 } from "@/components/ui/icons";
import { formatPrice, cn } from "@/lib/utils";
import { useAdminOrders } from "@/hooks/use-data";

const statusStyles: Record<string, string> = {
  completed: "bg-success/20 text-success",
  paid: "bg-primary/20 text-primary",
  processing: "bg-warning/20 text-warning",
  waiting_payment: "bg-accent/20 text-accent",
  pending: "bg-surface-light text-text-muted",
  cancelled: "bg-danger/20 text-danger",
};

const statusLabels: Record<string, string> = {
  completed: "Completed",
  paid: "Paid",
  processing: "Processing",
  waiting_payment: "Waiting Payment",
  pending: "Pending",
  cancelled: "Cancelled",
};

export default function AdminOrdersPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data, loading, error } = useAdminOrders({
    status: statusFilter !== "all" ? statusFilter : undefined,
    q: search || undefined,
  });
  const orders = data?.items || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Orders</h1>
          <p className="text-sm text-text-muted mt-1">Manage customer orders</p>
        </div>
        <button className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-muted hover:text-text hover:bg-surface transition-all">
          <Download className="h-4 w-4" />
          Export
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search orders..."
            className="w-full rounded-lg border border-border bg-background pl-10 pr-4 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary"
          />
        </div>
        <div className="flex gap-2">
          {["all", "pending", "paid", "completed", "cancelled"].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                statusFilter === status
                  ? "bg-primary text-white"
                  : "bg-surface-light text-text-muted hover:text-text"
              )}
            >
              {status === "all" ? "All" : statusLabels[status] || status}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card-premium overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-5 py-3">Order</th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-5 py-3">Customer</th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-5 py-3">Items</th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-5 py-3">Total</th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-5 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-5 py-3">Date</th>
                <th className="text-right text-xs font-semibold text-text-muted uppercase tracking-wider px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-danger">
                    Failed to load orders: {error}
                  </td>
                </tr>
              ) : orders.map((order) => (
                <tr key={order.id} className="hover:bg-surface-light/50 transition-colors">
                  <td className="px-5 py-4 text-sm font-mono text-text">{order.orderNumber}</td>
                  <td className="px-5 py-4 text-sm text-text">{order.customerName}</td>
                  <td className="px-5 py-4 text-sm text-text-muted">{order.items.length} items</td>
                  <td className="px-5 py-4 text-sm font-medium text-text">{formatPrice(order.total)}</td>
                  <td className="px-5 py-4">
                    <span className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium", statusStyles[order.status])}>
                      {statusLabels[order.status]}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm text-text-muted">{new Date(order.createdAt).toLocaleDateString("id-ID")}</td>
                  <td className="px-5 py-4 text-right">
                    <button className="text-text-muted hover:text-text p-1">
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
