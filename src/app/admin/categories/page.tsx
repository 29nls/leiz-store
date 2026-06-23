"use client";

import { useState } from "react";
import { Plus, Search, Edit, Trash2, Loader2 } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { useAdminCategories } from "@/hooks/use-data";

export default function AdminCategoriesPage() {
  const [search, setSearch] = useState("");

  const { data, loading, error } = useAdminCategories();
  const allCategories = data || [];
  const filtered = allCategories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Categories</h1>
          <p className="text-sm text-text-muted mt-1">Manage product categories</p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-light transition-all">
          <Plus className="h-4 w-4" />
          Add Category
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search categories..."
          className="w-full rounded-lg border border-border bg-background pl-10 pr-4 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-32">
          <p className="text-sm text-danger">Failed to load categories: {error}</p>
        </div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((cat) => (
          <div key={cat.id} className="card-premium p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{cat.icon}</span>
                <div>
                  <h3 className="text-sm font-medium text-text">{cat.name}</h3>
                  <p className="text-xs text-text-muted mt-0.5">{cat.products} products</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button className="text-text-muted hover:text-primary p-1">
                  <Edit className="h-4 w-4" />
                </button>
                <button className="text-text-muted hover:text-danger p-1">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-border">
              <span className={cn(
                "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                cat.isActive ? "bg-success/20 text-success" : "bg-surface-light text-text-muted"
              )}>
                {cat.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}
