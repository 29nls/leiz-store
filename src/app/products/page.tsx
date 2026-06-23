"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Package, Loader2, Search, X, ChevronDown } from "@/components/ui/icons";
import ProductCard from "@/components/product/ProductCard";
import { useProducts } from "@/hooks/use-data";
import type { SortOption } from "@/types";
import { cn } from "@/lib/utils";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "newest",     label: "Newest"              },
  { value: "price_asc",  label: "Price: Low → High"   },
  { value: "price_desc", label: "Price: High → Low"   },
  { value: "name",       label: "Name A – Z"          },
];

const CATEGORY_FILTERS = [
  { slug: "all",       label: "All Items"  },
  { slug: "insane-dn", label: "Insane DN"  },
];

function ProductsContent() {
  const searchParams  = useSearchParams();
  const initialSort   = (searchParams.get("sort") as SortOption) || "newest";

  const [search,   setSearch]   = useState("");
  const [category, setCategory] = useState("all");
  const [sort,     setSort]     = useState<SortOption>(initialSort);
  const [sortOpen, setSortOpen] = useState(false);

  const { data, loading, error } = useProducts({
    category: category !== "all" ? category : undefined,
    q:        search || undefined,
    sort,
  });

  const products  = data?.items ?? [];
  const activeSort = SORT_OPTIONS.find((o) => o.value === sort);

  return (
    <div className="min-h-screen">

      {/* ── Page header ── */}
      <div className="border-b border-white/[0.04] bg-[#060A10]">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12 pt-14 pb-10">

          {/* Title block */}
          <div className="mb-10">
            <h1
              className="font-black text-keynote tracking-[-0.035em] leading-none mb-2"
              style={{ fontSize: "clamp(30px, 4vw, 48px)" }}
            >
              Item Catalog
            </h1>
            <p className="text-[13px] text-text-muted">
              {loading
                ? "Loading…"
                : `${data?.total ?? products.length} item${(data?.total ?? products.length) !== 1 ? "s" : ""} available`}
            </p>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3">

            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-[320px]">
              <Search
                className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted/35 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search items…"
                aria-label="Search items"
                className={cn(
                  "w-full h-9 rounded-xl bg-[#0D1420] border border-[#1A2840] pl-9 pr-8",
                  "text-[13px] text-text placeholder:text-text-muted/35",
                  "focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/12",
                  "transition-all duration-300"
                )}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted/40 hover:text-text transition-colors"
                  aria-label="Clear search"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            <div aria-hidden="true" className="h-5 w-px bg-white/[0.07] hidden sm:block" />

            {/* Category pills */}
            <div className="flex items-center gap-1.5" role="group" aria-label="Filter by category">
              {CATEGORY_FILTERS.map((f) => (
                <button
                  key={f.slug}
                  onClick={() => setCategory(f.slug)}
                  className={cn(
                    "h-9 px-4 rounded-xl text-[12px] font-medium transition-all duration-300",
                    category === f.slug
                      ? "bg-primary text-white shadow-md shadow-primary/20"
                      : "bg-[#0D1420] border border-[#1A2840] text-text-muted hover:text-text hover:border-white/18"
                  )}
                  aria-pressed={category === f.slug}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Sort dropdown */}
            <div className="relative ml-auto">
              <button
                onClick={() => setSortOpen(!sortOpen)}
                className={cn(
                  "h-9 flex items-center gap-2 px-4 rounded-xl text-[12px] font-medium transition-all duration-300",
                  "bg-[#0D1420] border border-[#1A2840] text-text-muted hover:text-text hover:border-white/18"
                )}
                aria-expanded={sortOpen}
                aria-haspopup="listbox"
                aria-label={`Sort: ${activeSort?.label}`}
              >
                {activeSort?.label ?? "Sort"}
                <ChevronDown
                  className={cn(
                    "h-3 w-3 transition-transform duration-200",
                    sortOpen && "rotate-180"
                  )}
                  aria-hidden="true"
                />
              </button>

              {sortOpen && (
                <>
                  {/* Click-away */}
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setSortOpen(false)}
                    aria-hidden="true"
                  />
                  <div
                    className="absolute right-0 top-[calc(100%+6px)] z-30 w-48 rounded-xl bg-[#0D1420] border border-[#1A2840] shadow-2xl shadow-black/60 overflow-hidden animate-scale-in"
                    role="listbox"
                    aria-label="Sort options"
                  >
                    {SORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        role="option"
                        aria-selected={sort === opt.value}
                        onClick={() => { setSort(opt.value); setSortOpen(false); }}
                        className={cn(
                          "w-full text-left px-4 py-2.5 text-[12px] font-medium transition-colors",
                          sort === opt.value
                            ? "text-primary bg-primary/[0.07]"
                            : "text-text-muted hover:text-text hover:bg-white/[0.04]"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Grid ── */}
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12 py-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-36 gap-3">
            <Loader2 className="h-7 w-7 animate-spin text-primary/50" aria-hidden="true" />
            <p className="text-[13px] text-text-muted/45" role="status">Loading items…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-36 gap-3" role="alert">
            <p className="text-[13px] text-danger/70 font-medium">Failed to load items</p>
            <p className="text-[12px] text-text-muted/45">{error}</p>
          </div>
        ) : products.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4">
            {products.map((product, i) => (
              <div
                key={product.id}
                className="animate-fade-in"
                style={{ animationDelay: `${i * 0.04}s` }}
              >
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-36 gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0D1420] border border-[#1A2840]">
              <Package className="h-7 w-7 text-text-muted/20" aria-hidden="true" />
            </div>
            <div className="text-center">
              <p className="text-[14px] font-semibold text-text-secondary">No items found</p>
              <p className="text-[13px] text-text-muted/45 mt-1">
                {search ? `No results for "${search}"` : "Try a different filter"}
              </p>
            </div>
            {(search || category !== "all") && (
              <button
                onClick={() => { setSearch(""); setCategory("all"); }}
                className="text-[12px] text-primary hover:text-primary-light transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary/50" aria-hidden="true" />
        </div>
      }
    >
      <ProductsContent />
    </Suspense>
  );
}
