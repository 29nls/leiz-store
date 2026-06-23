"use client";

import { useState, useEffect } from "react";
import { SlideUp } from "@/components/ui/animated";
import {
  Activity,
  Loader2,
  RefreshCw,
  Filter,
  ShoppingCart,
  User,
  Package,
  Settings,
  LogIn,
  LogOut,
  Edit,
  Trash2,
  Eye,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";

interface ActivityLog {
  id: string;
  userId: string | null;
  user: { name: string; email: string } | null;
  action: string;
  entity: string | null;
  entityId: string | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
}

const actionIcons: Record<string, typeof Activity> = {
  LOGIN: LogIn,
  LOGOUT: LogOut,
  REGISTER: User,
  ORDER_CREATED: ShoppingCart,
  ORDER_STATUS_CHANGE: ShoppingCart,
  PRODUCT_CREATE: Package,
  PRODUCT_UPDATE: Edit,
  PRODUCT_DELETE: Trash2,
  SETTINGS_UPDATE: Settings,
};

const actionColors: Record<string, string> = {
  LOGIN: "text-success bg-success/15",
  LOGOUT: "text-text-muted bg-surface/60",
  REGISTER: "text-primary bg-primary/15",
  ORDER_CREATED: "text-accent bg-accent/15",
  ORDER_STATUS_CHANGE: "text-warning bg-warning/15",
  PRODUCT_CREATE: "text-success bg-success/15",
  PRODUCT_UPDATE: "text-primary bg-primary/15",
  PRODUCT_DELETE: "text-danger bg-danger/15",
  SETTINGS_UPDATE: "text-warning bg-warning/15",
};

export default function ActivityPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("");

  useEffect(() => {
    fetchLogs();
  }, [page, filter]);

  async function fetchLogs() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (filter) params.set("action", filter);
      const res = await fetch(`/api/admin/activity-logs?${params}`);
      const json = await res.json();
      if (json.success) {
        setLogs(json.data);
        setTotal(json.meta?.total || 0);
      }
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    } finally {
      setLoading(false);
    }
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-8">
      {/* Header */}
      <SlideUp
        delay={0}
        duration={0.5}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-text">Activity Logs</h1>
          <p className="text-sm text-text-muted/60 mt-1">
            Track all admin and system activities
          </p>
        </div>
        <button
          onClick={fetchLogs}
          className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-text-muted hover:text-text hover:bg-surface/40 transition-all"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Refresh
        </button>
      </SlideUp>

      {/* Filters */}
      <SlideUp
        delay={0.1}
        duration={0.5}
        className="flex flex-wrap gap-2"
      >
        <button
          onClick={() => { setFilter(""); setPage(1); }}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
            !filter ? "bg-primary/20 text-primary border border-primary/30" : "text-text-muted hover:text-text border border-white/10"
          )}
        >
          All
        </button>
        {["LOGIN", "ORDER_CREATED", "ORDER_STATUS_CHANGE", "PRODUCT_UPDATE", "SETTINGS_UPDATE"].map((a) => (
          <button
            key={a}
            onClick={() => { setFilter(a); setPage(1); }}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              filter === a ? "bg-primary/20 text-primary border border-primary/30" : "text-text-muted hover:text-text border border-white/10"
            )}
          >
            {a.replace(/_/g, " ")}
          </button>
        ))}
      </SlideUp>

      {/* Log List */}
      <SlideUp
        delay={0.15}
        duration={0.5}
        className="card-premium overflow-hidden"
      >
        <div className="divide-y divide-white/5">
          {logs.map((log) => {
            const Icon = actionIcons[log.action] || Activity;
            const color = actionColors[log.action] || "text-text-muted bg-surface/60";

            return (
              <div key={log.id} className="flex items-start gap-4 px-6 py-4 hover:bg-surface/30 transition-colors">
                <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0 mt-0.5", color)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-text">
                      {log.user?.name || "System"}
                    </span>
                    <span className="text-xs text-text-muted/60">
                      {log.action.replace(/_/g, " ").toLowerCase()}
                    </span>
                    {log.entity && (
                      <span className="text-xs text-primary/80">
                        {log.entity}
                      </span>
                    )}
                  </div>
                  {log.details && (
                    <p className="text-xs text-text-muted/50 mt-1 truncate max-w-md">
                      {log.details}
                    </p>
                  )}
                  <p className="text-[11px] text-text-muted/40 mt-1">
                    {new Date(log.createdAt).toLocaleString("id-ID")} • {log.ipAddress || "N/A"}
                  </p>
                </div>
              </div>
            );
          })}
          {logs.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-16 text-sm text-text-muted/40">
              <Activity className="h-12 w-12 mb-4 opacity-20" />
              <p>No activity logs found</p>
            </div>
          )}
        </div>
      </SlideUp>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-text-muted hover:text-text border border-white/10 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs text-text-muted/60">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-text-muted hover:text-text border border-white/10 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
