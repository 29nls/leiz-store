/**
 * Client-side data fetching hooks for public pages
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ─── Generic Fetch Hook ──────────────────────────────────────

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

function useFetch<T>(url: string, options?: RequestInit): FetchState<T> & { refetch: () => void } {
  const [state, setState] = useState<FetchState<T>>({ data: null, loading: true, error: null });
  const [fetchKey, setFetchKey] = useState(0);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const refetch = useCallback(() => setFetchKey((k) => k + 1), []);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((optionsRef.current?.headers as Record<string, string>) || {}),
    };

    fetch(url, { ...optionsRef.current, headers })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || body.message || `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((json) => {
        if (!cancelled) {
          // API responses follow { success, data, meta? } envelope.
          // When data is an array and meta exists (paginated list), merge
          // them into { items, page, limit, total, totalPages } so hooks
          // that expect a paginated response shape work correctly.
          let resolved: T;
          if (
            json &&
            typeof json === "object" &&
            "data" in json &&
            "meta" in json &&
            Array.isArray(json.data) &&
            json.meta &&
            typeof json.meta === "object"
          ) {
            resolved = {
              items: json.data,
              ...json.meta,
            } as unknown as T;
          } else {
            resolved = (json.data ?? json) as T;
          }
          setState({ data: resolved, loading: false, error: null });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setState({ data: null, loading: false, error: err.message });
        }
      });

    return () => { cancelled = true; };
  }, [url, fetchKey]);

  return { ...state, refetch };
}

// ─── Product List Item (API shape) ────────────────────────────

export interface ProductListItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  priceUSD?: number;
  comparePrice?: number;
  unit: string;
  stock: number;
  minStock: number;
  badge?: string;
  isActive: boolean;
  isFeatured: boolean;
  categoryId: string;
  category: { id: string; name: string; slug: string; sortOrder?: number; isActive?: boolean };
  images: Array<{ id: string; url: string; sortOrder: number }>;
  createdAt: string;
  updatedAt?: string;
  priceFormatted?: string;
}

interface ProductsResponse {
  items: ProductListItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function useProducts(params?: {
  category?: string;
  q?: string;
  sort?: string;
  badge?: string;
  featured?: boolean;
  page?: number;
  limit?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params?.category && params.category !== "all") searchParams.set("category", params.category);
  if (params?.q) searchParams.set("q", params.q);
  if (params?.sort) searchParams.set("sort", params.sort);
  if (params?.badge) searchParams.set("badge", params.badge);
  if (params?.featured) searchParams.set("featured", "true");
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));

  const qs = searchParams.toString();
  return useFetch<ProductsResponse>(`/api/products${qs ? `?${qs}` : ""}`);
}

// ─── Public Product Detail Hook ──────────────────────────────

export interface ProductDetail extends ProductListItem {
  related?: ProductListItem[];
}

export function useProduct(slug: string | null) {
  return useFetch<ProductDetail>(slug ? `/api/products/${slug}` : "");
}
