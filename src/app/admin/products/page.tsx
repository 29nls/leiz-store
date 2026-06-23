"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Plus, Search, Edit, Trash2, Loader2, Package, AlertCircle, CheckCircle } from "@/components/ui/icons";
import { formatPrice, cn } from "@/lib/utils";
import { useAdminProducts, useAdminCategories } from "@/hooks/use-data";
import ProductModal, { type ProductFormData } from "@/components/admin/ProductModal";

export default function AdminProductsPage() {
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductFormData | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const { data, loading, error, refetch } = useAdminProducts({ q: search || undefined });
  const { data: categoriesData, error: categoriesError } = useAdminCategories();
  
  const products = data?.items || [];
  const categories = categoriesData || [];

  // Show error toast if categories fail to load
  useEffect(() => {
    if (categoriesError) {
      showToast("error", `Failed to load categories: ${categoriesError}`);
    }
  }, [categoriesError]);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  const handleAddProduct = () => {
    if (categories.length === 0) {
      showToast("error", "No categories available. Please create a category first.");
      return;
    }
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const handleEditProduct = (product: any) => {
    setEditingProduct({
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      priceUSD: product.priceUSD,
      comparePrice: product.comparePrice,
      comparePriceUSD: product.comparePriceUSD,
      unit: product.unit,
      stock: product.stock,
      minStock: product.minStock,
      badge: product.badge,
      isActive: product.isActive,
      isFeatured: product.isFeatured,
      categoryId: product.categoryId,
      imageUrl: product.images[0]?.url || "",
    });
    setIsModalOpen(true);
  };

  const handleDeleteProduct = async (productId: string, productName: string) => {
    if (!confirm(`Are you sure you want to delete "${productName}"? This action cannot be undone.`)) {
      return;
    }

    setDeletingId(productId);

    try {
      const response = await fetch(`/api/admin/products/${productId}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to delete product");
      }

      showToast("success", "Product deleted successfully");
      refetch();
    } catch (err) {
      const error = err as Error;
      showToast("error", error.message || "Failed to delete product");
    } finally {
      setDeletingId(null);
    }
  };

  const handleSubmitProduct = async (formData: ProductFormData) => {
    const isEdit = !!formData.id;
    const url = isEdit
      ? `/api/admin/products/${formData.id}`
      : "/api/admin/products";
    const method = isEdit ? "PUT" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || `Failed to ${isEdit ? "update" : "create"} product`);
    }

    showToast("success", `Product ${isEdit ? "updated" : "created"} successfully`);
    refetch();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Toast Notification */}
      {toast && (
        <div
          className={cn(
            "fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg animate-fade-in",
            toast.type === "success"
              ? "bg-success/20 border border-success text-success"
              : "bg-danger/20 border border-danger text-danger"
          )}
        >
          {toast.type === "success" ? (
            <CheckCircle className="h-5 w-5" />
          ) : (
            <AlertCircle className="h-5 w-5" />
          )}
          <p className="text-sm font-medium">{toast.message}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Products</h1>
          <p className="text-sm text-text-muted mt-1">Manage your product catalog</p>
        </div>
        <button
          onClick={handleAddProduct}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-background hover:bg-primary/90 transition-all"
        >
          <Plus className="h-4 w-4" />
          Add Product
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products..."
          className="w-full rounded-lg border border-border bg-surface pl-10 pr-4 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary"
        />
      </div>

      {/* Table */}
      <div className="dn-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-5 py-3">
                  Product
                </th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-5 py-3">
                  Category
                </th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-5 py-3">
                  Price
                </th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-5 py-3">
                  Stock
                </th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-5 py-3">
                  Status
                </th>
                <th className="text-right text-xs font-semibold text-text-muted uppercase tracking-wider px-5 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-danger">
                    Failed to load products: {error}
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-text-muted">
                    No products found. Click &quot;Add Product&quot; to create your first product.
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr
                    key={product.id}
                    className="hover:bg-surface-light/50 transition-colors"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="relative h-10 w-10 rounded-lg overflow-hidden bg-surface flex-shrink-0">
                          {product.images[0]?.url ? (
                            <Image
                              src={product.images[0].url}
                              alt={product.name}
                              fill
                              className="object-cover"
                              sizes="40px"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-text-muted">
                              <Package className="h-5 w-5" />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-text">
                            {product.name}
                          </p>
                          {product.badge && (
                            <span className="text-xs text-primary">
                              {product.badge}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-text-muted">
                      {product.category.name}
                    </td>
                    <td className="px-5 py-4 text-sm font-medium text-text">
                      {formatPrice(product.price)}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={cn(
                          "text-sm font-medium",
                          product.stock <= product.minStock
                            ? "text-warning"
                            : "text-success"
                        )}
                      >
                        {product.stock}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={cn(
                          "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium",
                          product.isActive
                            ? "bg-success/20 text-success"
                            : "bg-surface-light text-text-muted"
                        )}
                      >
                        {product.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEditProduct(product)}
                          className="text-text-muted hover:text-primary p-1 transition-colors"
                          title="Edit product"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() =>
                            handleDeleteProduct(product.id, product.name)
                          }
                          disabled={deletingId === product.id}
                          className="text-text-muted hover:text-danger p-1 transition-colors disabled:opacity-50"
                          title="Delete product"
                        >
                          {deletingId === product.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Modal */}
      <ProductModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingProduct(null);
        }}
        onSubmit={handleSubmitProduct}
        product={editingProduct || undefined}
        categories={categories}
      />
    </div>
  );
}
