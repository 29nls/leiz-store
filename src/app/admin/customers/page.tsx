"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { SlideUp } from "@/components/ui/animated";
import {
  Users,
  Loader2,
  RefreshCw,
  Crown,
  Heart,
  AlertTriangle,
  Clock,
  Sparkles,
  Brain,
} from "@/components/ui/icons";
import { cn, formatPrice } from "@/lib/utils";

interface Segment {
  segment: string;
  count: number;
  avgLifetimeValue: number | null;
}

const segmentConfig: Record<string, { label: string; color: string; icon: typeof Crown; description: string }> = {
  champion: { label: "Champions", color: "text-warning", icon: Crown, description: "Best customers - high RFM scores across the board" },
  loyal: { label: "Loyal", color: "text-primary", icon: Heart, description: "Regular buyers who keep coming back" },
  potential_loyalist: { label: "Potential Loyalists", color: "text-accent", icon: Sparkles, description: "Recent buyers with good potential" },
  new_high_value: { label: "New High Value", color: "text-success", icon: Sparkles, description: "New customers with big first purchases" },
  need_attention: { label: "Need Attention", color: "text-warning", icon: AlertTriangle, description: "Average customers who could slip away" },
  at_risk: { label: "At Risk", color: "text-danger", icon: AlertTriangle, description: "Good customers who haven't bought recently" },
  hibernating: { label: "Hibernating", color: "text-text-muted", icon: Clock, description: "Inactive customers" },
  new: { label: "New", color: "text-text-muted", icon: Users, description: "First-time or no purchase customers" },
};

export default function CustomersPage() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    fetchSegments();
  }, []);

  async function fetchSegments() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/segments");
      const json = await res.json();
      if (json.success) setSegments(json.data);
    } catch (err) {
      console.error("Failed to fetch segments:", err);
    } finally {
      setLoading(false);
    }
  }

  async function calculateSegments() {
    setCalculating(true);
    try {
      const res = await fetch("/api/admin/segments", { method: "POST" });
      const json = await res.json();
      if (json.success) setSegments(json.data);
      await fetchSegments();
    } catch (err) {
      console.error("Failed to calculate segments:", err);
    } finally {
      setCalculating(false);
    }
  }

  const totalCustomers = segments.reduce((s, seg) => s + seg.count, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <SlideUp
        delay={0}
        duration={0.5}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-text">Customer Segmentation</h1>
          <p className="text-sm text-text-muted/60 mt-1">
            RFM analysis and customer lifecycle segments
          </p>
        </div>
        <button
          onClick={calculateSegments}
          disabled={calculating}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 hover:bg-primary-light transition-all disabled:opacity-50"
        >
          {calculating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Brain className="h-4 w-4" />
          )}
          {calculating ? "Calculating..." : "Recalculate Segments"}
        </button>
      </SlideUp>

      {/* Total */}
      <SlideUp
        delay={0.1}
        duration={0.5}
        className="card-premium p-6 flex items-center gap-4"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-text">{totalCustomers}</p>
          <p className="text-xs text-text-muted/60">Total Segmented Customers</p>
        </div>
      </SlideUp>

      {/* Segment Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {segments.map((seg, i) => {
          const config = segmentConfig[seg.segment] || {
            label: seg.segment,
            color: "text-text-muted",
            icon: Users,
            description: "Customer segment",
          };
          const Icon = config.icon;
          const pct = totalCustomers > 0 ? (seg.count / totalCustomers) * 100 : 0;

          return (
            <SlideUp
              key={seg.segment}
              delay={0.15 + i * 0.06}
              duration={0.5}
              className="card-premium p-5 group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-2xl bg-surface/60", config.color)}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-xs font-medium text-text-muted/60">{pct.toFixed(0)}%</span>
              </div>
              <p className="text-2xl font-bold text-text">{seg.count}</p>
              <p className="text-sm font-medium text-text mt-1">{config.label}</p>
              <p className="text-[11px] text-text-muted/50 mt-1 leading-relaxed">{config.description}</p>
              {seg.avgLifetimeValue && seg.avgLifetimeValue > 0 && (
                <p className="text-xs text-text-muted/60 mt-2">
                  Avg. LTV: {formatPrice(seg.avgLifetimeValue)}
                </p>
              )}
              {/* Progress bar */}
              <div className="mt-3 h-1.5 rounded-full bg-surface/60 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, delay: 0.3 + i * 0.05 }}
                />
              </div>
            </SlideUp>
          );
        })}
      </div>

      {/* RFM Explanation */}
      <SlideUp
        delay={0.5}
        duration={0.5}
        className="card-premium p-6"
      >
        <h3 className="text-sm font-semibold text-text mb-3">How RFM Segmentation Works</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl bg-surface/40 p-4 border border-white/5">
            <p className="text-xs font-semibold text-primary mb-1">Recency</p>
            <p className="text-[11px] text-text-muted/60">
              How recently a customer purchased. Scored 1-5 (5 = most recent).
            </p>
          </div>
          <div className="rounded-xl bg-surface/40 p-4 border border-white/5">
            <p className="text-xs font-semibold text-accent mb-1">Frequency</p>
            <p className="text-[11px] text-text-muted/60">
              How often they purchase. Scored 1-5 (5 = most frequent).
            </p>
          </div>
          <div className="rounded-xl bg-surface/40 p-4 border border-white/5">
            <p className="text-xs font-semibold text-success mb-1">Monetary</p>
            <p className="text-[11px] text-text-muted/60">
              How much they spend. Scored 1-5 (5 = highest spender).
            </p>
          </div>
        </div>
      </SlideUp>
    </div>
  );
}
