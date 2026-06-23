/**
 * Client-side data fetching hooks for admin and public pages
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
  }, [url, fetchKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return { ...state, refetch };
}

// ─── Admin Dashboard Hook ────────────────────────────────────

export interface DashboardStats {
  overview: {
    totalRevenue: number;
    totalRevenueUSD: number;
    totalOrders: number;
    revenueChange: number;
    ordersChange: number;
    totalProducts: number;
    lowStockCount: number;
    totalCustomers: number;
    newCustomers: number;
  };
  charts: {
    dailyRevenue: Array<{ date: string; revenue: number; orders: number }>;
    paymentMethods: Array<{ method: string; count: number }>;
    topProducts: Array<{ productId: string; name: string; revenue: number; orders: number }>;
  };
  events?: Record<string, number>;
}

export function useAdminDashboard() {
  return useFetch<DashboardStats>("/api/admin/analytics");
}

// ─── Admin Orders Hook ───────────────────────────────────────

export interface AdminOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail?: string;
  status: string;
  total: number;
  createdAt: string;
  items: Array<{ id: string; name: string; quantity: number; price: number }>;
}

interface AdminOrdersResponse {
  items: AdminOrder[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function useAdminOrders(params?: { status?: string; q?: string; page?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.status && params.status !== "all") searchParams.set("status", params.status);
  if (params?.q) searchParams.set("q", params.q);
  if (params?.page) searchParams.set("page", String(params.page));

  const qs = searchParams.toString();
  return useFetch<AdminOrdersResponse>(`/api/admin/orders${qs ? `?${qs}` : ""}`);
}

// ─── Admin Customers Hook ────────────────────────────────────

export interface AdminCustomer {
  id: string;
  name: string;
  email: string;
  orders: number;
  spent: number;
  lastOrder: string | null;
  createdAt: string;
}

interface AdminCustomersResponse {
  items: AdminCustomer[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function useAdminCustomers(params?: { q?: string; page?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.q) searchParams.set("q", params.q);
  if (params?.page) searchParams.set("page", String(params.page));

  const qs = searchParams.toString();
  return useFetch<AdminCustomersResponse>(`/api/admin/customers${qs ? `?${qs}` : ""}`);
}

// ─── Admin Categories Hook ───────────────────────────────────

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  sortOrder: number;
  isActive: boolean;
  products: number;
}

export function useAdminCategories() {
  return useFetch<AdminCategory[]>("/api/admin/categories");
}

// ─── Admin Products Hook ─────────────────────────────────────

export interface AdminProduct {
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
  category: { id: string; name: string; slug: string };
  images: Array<{ id: string; url: string; sortOrder: number }>;
  createdAt: string;
  priceFormatted?: string;
}

interface AdminProductsResponse {
  items: AdminProduct[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function useAdminProducts(params?: { q?: string; page?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.q) searchParams.set("q", params.q);
  if (params?.page) searchParams.set("page", String(params.page));
  searchParams.set("limit", "100");

  const qs = searchParams.toString();
  return useFetch<AdminProductsResponse>(`/api/products${qs ? `?${qs}` : ""}`);
}

// ─── Stock Alerts Hook ───────────────────────────────────────

export interface StockAlertItem {
  id: string;
  productId: string;
  type: string;
  threshold: number;
  currentStock: number;
  isRead: boolean;
  isSent: boolean;
  sentVia: string | null;
  storeId: string | null;
  createdAt: string;
}

export function useAdminStockAlerts(params?: { unread?: boolean; page?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.unread) searchParams.set("unread", "true");
  if (params?.page) searchParams.set("page", String(params.page));

  const qs = searchParams.toString();
  return useFetch<StockAlertItem[]>(`/api/admin/stock-alerts${qs ? `?${qs}` : ""}`);
}

// ─── Sales Forecast Hook ──────────────────────────────────────

export interface ForecastItem {
  id: string;
  productId: string | null;
  categoryId: string | null;
  storeId: string | null;
  period: string;
  predictedValue: number;
  actualValue: number | null;
  confidence: number;
  algorithm: string;
  createdAt: string;
}

export function useAdminForecasts() {
  return useFetch<ForecastItem[]>("/api/admin/forecast");
}

// ─── Activity Logs Hook ───────────────────────────────────────

export interface ActivityLogEntry {
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

interface ActivityLogsResponse {
  items: ActivityLogEntry[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function useAdminActivityLogs(params?: { action?: string; page?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.action) searchParams.set("action", params.action);
  if (params?.page) searchParams.set("page", String(params.page));

  const qs = searchParams.toString();
  return useFetch<ActivityLogsResponse>(`/api/admin/activity-logs${qs ? `?${qs}` : ""}`);
}

// ─── Customer Segments Hook ───────────────────────────────────

export interface CustomerSegmentSummary {
  segment: string;
  count: number;
  avgLifetimeValue: number;
}

export function useAdminSegments() {
  return useFetch<CustomerSegmentSummary[]>("/api/admin/segments");
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
