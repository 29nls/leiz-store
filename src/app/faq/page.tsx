"use client";

import { useEffect, useState } from "react";
import { ChevronDown, MessageSquare, Loader2 } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

/* ─── FAQ data (graceful column handling) ────────────────────── */

type FaqRow = Record<string, unknown>;

function pickText(row: FaqRow, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function useFaq() {
  const [rows, setRows] = useState<FaqRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("faq")
          .select("*")
          .limit(50);
        if (cancelled) return;
        if (error) {
          setFailed(true);
          return;
        }
        setRows(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { rows, failed };
}

export default function FaqPage() {
  const { rows, failed } = useFaq();
  const [open, setOpen] = useState<number | null>(0);

  const items =
    rows
      ?.map((r) => ({
        q: pickText(r, ["question", "q", "title", "query", "ask", "heading"]),
        a: pickText(r, ["answer", "a", "body", "content", "response", "text", "reply"]),
      }))
      .filter((t) => t.q && t.a) ?? [];

  return (
    <main className="min-h-screen pb-28">
      {/* ── Page header ── */}
      <div className="border-b border-border bg-void">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12 pt-14 pb-10">
          <h1
            className="font-black text-text-primary tracking-[-0.035em] leading-none mb-2"
            style={{ fontSize: "clamp(30px, 4vw, 48px)" }}
          >
            Frequently Asked Questions
          </h1>
          <p className="text-[13px] text-text-secondary">
            Answers to the most common questions about ordering, payment, and delivery.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-5 sm:px-8 lg:px-12 py-12">

        {rows === null ? (
          <div className="flex items-center gap-3 text-text-secondary/45 py-10">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
            <span className="text-[13px]" role="status">Loading FAQ…</span>
          </div>
        ) : failed || items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-border bg-surface py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-void border border-border">
              <MessageSquare className="h-6 w-6 text-text-secondary/20" aria-hidden="true" />
            </div>
            <p className="text-[14px] font-semibold text-text-secondary">FAQ coming soon.</p>
          </div>
        ) : (
          <div className="divide-y divide-border border-y border-border">
            {items.map((item, i) => {
              const isOpen = open === i;
              return (
                <div key={i}>
                  <button
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-4 py-5 text-left"
                  >
                    <span className="text-[15px] font-medium text-text-primary">{item.q}</span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 text-text-secondary/50 transition-transform duration-200",
                        isOpen && "rotate-180"
                      )}
                      aria-hidden="true"
                    />
                  </button>
                  {isOpen && (
                    <p className="pb-5 -mt-1 text-[14px] leading-[1.85] text-text-secondary">
                      {item.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
