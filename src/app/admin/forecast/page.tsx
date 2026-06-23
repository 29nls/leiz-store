"use client";

import { useState, useEffect } from "react";
import { SlideUp } from "@/components/ui/animated";
import {
  TrendingUp,
  RefreshCw,
  Brain,
  Calendar,
  Loader2,
} from "@/components/ui/icons";
import { formatPrice, cn } from "@/lib/utils";

interface Forecast {
  id: string;
  period: string;
  predictedValue: number;
  actualValue: number | null;
  confidence: number;
  algorithm: string;
}

export default function ForecastPage() {
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [dataPoints, setDataPoints] = useState(0);

  useEffect(() => {
    fetchForecasts();
  }, []);

  async function fetchForecasts() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/forecast");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setForecasts(json.data);
      } else {
        setForecasts([]);
      }
    } catch (err) {
      console.error("Failed to fetch forecasts:", err);
      setForecasts([]);
    } finally {
      setLoading(false);
    }
  }

  async function generateForecasts() {
    setGenerating(true);
    try {
      const res = await fetch("/api/admin/forecast", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        const forecastsData = json.data.forecasts || json.data || [];
        setForecasts(Array.isArray(forecastsData) ? forecastsData : []);
        setDataPoints(json.data.dataPoints || 0);
      }
      await fetchForecasts();
    } catch (err) {
      console.error("Failed to generate forecasts:", err);
      setForecasts([]);
    } finally {
      setGenerating(false);
    }
  }

  const maxValue = Array.isArray(forecasts) && forecasts.length > 0
    ? Math.max(...forecasts.map((f) => f.predictedValue), 1)
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
          <h1 className="text-2xl lg:text-3xl font-bold text-text">Sales Forecasting</h1>
          <p className="text-sm text-text-muted/60 mt-1">
            AI-powered revenue predictions based on historical data
          </p>
        </div>
        <button
          onClick={generateForecasts}
          disabled={generating}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 hover:bg-primary-light transition-all disabled:opacity-50"
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Brain className="h-4 w-4" />
          )}
          {generating ? "Generating..." : "Generate Forecasts"}
        </button>
      </SlideUp>

      {/* Algorithm Info */}
      <SlideUp
        delay={0.1}
        duration={0.5}
        className="card-premium p-6"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary flex-shrink-0">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text">Forecasting Algorithm</h3>
            <p className="text-xs text-text-muted/60 mt-1">
              Uses 7-day Simple Moving Average (SMA) on historical order data.
              Confidence decreases for dates further in the future.
              {dataPoints > 0 && ` Based on ${dataPoints} data points.`}
            </p>
          </div>
        </div>
      </SlideUp>

      {/* Forecast Chart */}
      <SlideUp
        delay={0.2}
        duration={0.5}
        className="card-premium overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
          <h2 className="text-lg font-semibold text-text">7-Day Revenue Forecast</h2>
          <div className="flex items-center gap-2 text-xs text-text-muted/60">
            <Calendar className="h-3.5 w-3.5" />
            Next 7 days
          </div>
        </div>
        <div className="p-6">
          {Array.isArray(forecasts) && forecasts.length > 0 ? (
            <div className="space-y-4">
              {/* Bar chart */}
              <div className="flex items-end gap-3 h-48">
                {forecasts.slice(0, 7).map((f, i) => (
                  <div key={f.id} className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full relative group" style={{ height: "100%" }}>
                      <div
                        className="absolute bottom-0 w-full rounded-t-lg bg-gradient-to-t from-accent/60 to-primary/30 hover:from-accent hover:to-primary transition-all duration-300"
                        style={{ height: `${(f.predictedValue / maxValue) * 100}%` }}
                      />
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block z-10">
                        <div className="glass-strong rounded-lg px-2 py-1 text-[10px] text-text whitespace-nowrap shadow-lg">
                          {formatPrice(f.predictedValue)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Date labels */}
              <div className="flex gap-3">
                {forecasts.slice(0, 7).map((f) => (
                  <div key={f.id} className="flex-1 text-center">
                    <p className="text-[10px] text-text-muted/60">
                      {new Date(f.period).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-sm text-text-muted/40">
              <TrendingUp className="h-12 w-12 mb-4 opacity-20" />
              <p>No forecast data available</p>
              <p className="text-xs mt-1">Click &quot;Generate Forecasts&quot; to create predictions</p>
            </div>
          )}
        </div>
      </SlideUp>

      {/* Forecast Details Table */}
      {Array.isArray(forecasts) && forecasts.length > 0 && (
        <SlideUp
          delay={0.3}
          duration={0.5}
          className="card-premium overflow-hidden"
        >
          <div className="px-6 py-5 border-b border-white/5">
            <h2 className="text-lg font-semibold text-text">Forecast Details</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-[11px] font-semibold text-text-muted/50 uppercase tracking-wider px-6 py-3">
                    Date
                  </th>
                  <th className="text-right text-[11px] font-semibold text-text-muted/50 uppercase tracking-wider px-6 py-3">
                    Predicted
                  </th>
                  <th className="text-right text-[11px] font-semibold text-text-muted/50 uppercase tracking-wider px-6 py-3">
                    Confidence
                  </th>
                  <th className="text-left text-[11px] font-semibold text-text-muted/50 uppercase tracking-wider px-6 py-3">
                    Algorithm
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {forecasts.map((f) => (
                  <tr key={f.id} className="hover:bg-surface/30 transition-colors">
                    <td className="px-6 py-4 text-sm text-text">
                      {new Date(f.period).toLocaleDateString("id-ID", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-text text-right">
                      {formatPrice(f.predictedValue)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                          f.confidence >= 0.8
                            ? "bg-success/15 text-success"
                            : f.confidence >= 0.6
                            ? "bg-warning/15 text-warning"
                            : "bg-danger/15 text-danger"
                        )}
                      >
                        {(f.confidence * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-text-muted/60">{f.algorithm}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SlideUp>
      )}
    </div>
  );
}
