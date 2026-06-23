"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, X, SlidersHorizontal } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import type { SortOption } from "@/types";

const categories = [
  { slug: "all", name: "All" },
  { slug: "insane-dn", name: "Insane DN" },
];

const sortOptions: { value: SortOption; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "name", label: "Name A-Z" },
];

interface ProductFiltersProps {
  search: string;
  category: string;
  sort: SortOption;
  onSearchChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onSortChange: (value: SortOption) => void;
}

export default function ProductFilters({
  search,
  category,
  sort,
  onSearchChange,
  onCategoryChange,
  onSortChange,
}: ProductFiltersProps) {
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="space-y-4">
      {/* Search & Filter Toggle */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search products..."
            className="w-full rounded-xl border border-border bg-surface pl-11 pr-4 py-3 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
          />
          {search && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            "flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-all",
            showFilters
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-surface text-text-muted hover:text-text hover:border-border"
          )}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
        </button>
      </div>

      {/* Expanded Filters */}
      {showFilters && (
        <div className="rounded-xl border border-border bg-surface p-4 space-y-4 animate-slide-up">
          {/* Categories */}
          <div>
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
              Categories
            </h3>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.slug}
                  onClick={() => onCategoryChange(cat.slug)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                    category === cat.slug
                      ? "bg-primary text-white"
                      : "bg-surface-light text-text-muted hover:text-text"
                  )}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Sort */}
          <div>
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
              Sort By
            </h3>
            <div className="flex flex-wrap gap-2">
              {sortOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onSortChange(opt.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                    sort === opt.value
                      ? "bg-primary text-white"
                      : "bg-surface-light text-text-muted hover:text-text"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
