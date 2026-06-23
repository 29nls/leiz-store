"use client";

import { useState, useEffect } from "react";
import { SlideUp } from "@/components/ui/animated";
import {
  Bell,
  Send,
  CheckCircle2,
  XCircle,
  Loader2,
  MessageSquare,
  Smartphone,
  Mail,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  channel: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  sentAt: string | null;
  createdAt: string;
}

const channelIcons: Record<string, typeof Bell> = {
  telegram: Send,
  discord: MessageSquare,
  whatsapp: Smartphone,
  email: Mail,
};

const channelColors: Record<string, string> = {
  telegram: "text-blue-400 bg-blue-400/15",
  discord: "text-indigo-400 bg-indigo-400/15",
  whatsapp: "text-green-400 bg-green-400/15",
  email: "text-orange-400 bg-orange-400/15",
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, [page]);

  async function fetchNotifications() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/notifications?page=${page}&limit=20`);
      const json = await res.json();
      if (json.success) {
        setNotifications(json.data);
        setTotal(json.meta?.total || 0);
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
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
          <h1 className="text-2xl lg:text-3xl font-bold text-text">Notifications</h1>
          <p className="text-sm text-text-muted/60 mt-1">
            Notification history across all channels
          </p>
        </div>
        <div className="text-sm text-text-muted/60">{total} total notifications</div>
      </SlideUp>

      {/* Channel Status */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[  
          { name: "Telegram", key: "telegram" },
          { name: "Discord", key: "discord" },
          { name: "WhatsApp", key: "whatsapp" },
          { name: "Email", key: "email" },
        ].map((ch) => {
          const Icon = channelIcons[ch.key] || Bell;
          const color = channelColors[ch.key] || "text-text-muted bg-surface/60";
          const hasActivity = notifications.some((n) => n.channel === ch.key);
          return (
            <SlideUp
              key={ch.key}
              delay={0.1}
              duration={0.5}
              className="card-premium p-4 flex items-center gap-3"
            >
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", color)}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-text">{ch.name}</p>
                <p className="text-[10px] text-text-muted/50">
                  {hasActivity ? "Active" : "No activity"}
                </p>
              </div>
            </SlideUp>
          );
        })}
      </div>

      {/* Notification List */}
      <SlideUp
        delay={0.2}
        duration={0.5}
        className="card-premium overflow-hidden"
      >
        <div className="divide-y divide-white/5">
          {notifications.map((n) => {
            const Icon = channelIcons[n.channel] || Bell;
            const color = channelColors[n.channel] || "text-text-muted bg-surface/60";

            return (
              <div key={n.id} className="flex items-start gap-4 px-6 py-4 hover:bg-surface/30 transition-colors">
                <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0 mt-0.5", color)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text capitalize">{n.channel}</span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                        n.status === "SENT"
                          ? "bg-success/15 text-success"
                          : n.status === "FAILED"
                          ? "bg-danger/15 text-danger"
                          : "bg-surface/60 text-text-muted"
                      )}
                    >
                      {n.status === "SENT" ? (
                        <CheckCircle2 className="h-2.5 w-2.5" />
                      ) : n.status === "FAILED" ? (
                        <XCircle className="h-2.5 w-2.5" />
                      ) : (
                        <Loader2 className="h-2.5 w-2.5" />
                      )}
                      {n.status}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted/60 mt-0.5">{n.subject}</p>
                  <p className="text-xs text-text-muted/40 mt-1 truncate max-w-lg">{n.body}</p>
                  <p className="text-[11px] text-text-muted/30 mt-1">
                    {new Date(n.createdAt).toLocaleString("id-ID")}
                    {n.sentAt && ` • Sent ${new Date(n.sentAt).toLocaleString("id-ID")}`}
                  </p>
                </div>
              </div>
            );
          })}
          {notifications.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-16 text-sm text-text-muted/40">
              <Bell className="h-12 w-12 mb-4 opacity-20" />
              <p>No notifications sent yet</p>
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
