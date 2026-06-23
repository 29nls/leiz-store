"use client";

import { useState, useEffect } from "react";
import { X, Loader2, Upload, AlertCircle } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ProductFormData) => Promise<void>;
  product?: ProductFormData;
  categories: Array<{ id: string; name: string }>;
}

export interface ProductFormData {
  id?: string;
  name: string;
  description: string;
  price: number;
  priceUSD?: number;
  comparePrice?: number;
  comparePriceUSD?: number;
  unit: string;
  stock: number;
  minStock: number;
  badge?: string;
  isActive: boolean;
  isFeatured: boolean;
  categoryId: string;
  imageUrl?: string;
}

export default function ProductModal({
  isOpen,
  onClose,
  onSubmit,
  product,
  categories,
}: ProductModalProps) {
  const isEdit = !!product?.id;

  const [formData, setFormData] = useState<ProductFormData>({
    name: "",
    description: "",
    price: 0,
    priceUSD: undefined,
    comparePrice: undefined,
    comparePriceUSD: undefined,
    unit: "pc",
    stock: 0,
    minStock: 10,
    badge: undefined,
    isActive: true,
    isFeatured: false,
    categoryId: "",
    imageUrl: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (product) {
      setFormData({
        ...product,
        badge: product.badge || undefined,
      });
    } else if (categories.length > 0) {
      setFormData({
        name: "",
        description: "",
        price: 0,
        priceUSD: undefined,
        comparePrice: undefined,
        comparePriceUSD: undefined,
        unit: "pc",
        stock: 0,
        minStock: 10,
        badge: undefined,
        isActive: true,
        isFeatured: false,
        categoryId: categories[0]?.id || "",
        imageUrl: "",
      });
    }
    setError(null);
  }, [product, categories]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await onSubmit(formData);
      onClose();
    } catch (err) {
      const error = err as Error;
      setError(error.message || "Failed to save product");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    field: keyof ProductFormData,
    value: string | number | boolean | undefined
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-surface rounded-xl border border-border shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-6 bg-surface border-b border-border">
          <h2 className="text-xl font-bold text-text">
            {isEdit ? "Edit Product" : "Add New Product"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-surface-light transition-colors"
          >
            <X className="h-5 w-5 text-text-muted" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-danger/10 border border-danger/20">
              <AlertCircle className="h-5 w-5 text-danger flex-shrink-0 mt-0.5" />
              <p className="text-sm text-danger">{error}</p>
            </div>
          )}

          {/* Product Name */}
          <div>
            <label className="dn-label-text">
              Product Name <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="Enter product name"
              className="dn-input"
            />
          </div>

          {/* Description */}
          <div>
            <label className="dn-label-text">
              Description <span className="text-danger">*</span>
            </label>
            <textarea
              required
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
              placeholder="Enter product description"
              rows={4}
              className="dn-textarea"
            />
          </div>

          {/* Price Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="dn-label-text">
                Price (IDR) <span className="text-danger">*</span>
              </label>
              <input
                type="number"
                required
                min="0"
                step="1000"
                value={formData.price}
                onChange={(e) => handleChange("price", Number(e.target.value))}
                placeholder="0"
                className="dn-input"
              />
            </div>
            <div>
              <label className="dn-label-text">Price (USD)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.priceUSD || ""}
                onChange={(e) =>
                  handleChange(
                    "priceUSD",
                    e.target.value ? Number(e.target.value) : undefined
                  )
                }
                placeholder="Optional"
                className="dn-input"
              />
            </div>
          </div>

          {/* Compare Price Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="dn-label-text">Compare Price (IDR)</label>
              <input
                type="number"
                min="0"
                step="1000"
                value={formData.comparePrice || ""}
                onChange={(e) =>
                  handleChange(
                    "comparePrice",
                    e.target.value ? Number(e.target.value) : undefined
                  )
                }
                placeholder="Optional"
                className="dn-input"
              />
            </div>
            <div>
              <label className="dn-label-text">Compare Price (USD)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.comparePriceUSD || ""}
                onChange={(e) =>
                  handleChange(
                    "comparePriceUSD",
                    e.target.value ? Number(e.target.value) : undefined
                  )
                }
                placeholder="Optional"
                className="dn-input"
              />
            </div>
          </div>

          {/* Stock Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="dn-label-text">
                Stock <span className="text-danger">*</span>
              </label>
              <input
                type="number"
                required
                min="0"
                value={formData.stock}
                onChange={(e) => handleChange("stock", Number(e.target.value))}
                placeholder="0"
                className="dn-input"
              />
            </div>
            <div>
              <label className="dn-label-text">
                Min Stock <span className="text-danger">*</span>
              </label>
              <input
                type="number"
                required
                min="0"
                value={formData.minStock}
                onChange={(e) =>
                  handleChange("minStock", Number(e.target.value))
                }
                placeholder="10"
                className="dn-input"
              />
            </div>
            <div>
              <label className="dn-label-text">
                Unit <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.unit}
                onChange={(e) => handleChange("unit", e.target.value)}
                placeholder="pc"
                className="dn-input"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="dn-label-text">
              Category <span className="text-danger">*</span>
            </label>
            <select
              required
              value={formData.categoryId}
              onChange={(e) => handleChange("categoryId", e.target.value)}
              className="dn-input"
            >
              <option value="">Select category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Badge */}
          <div>
            <label className="dn-label-text">Badge</label>
            <select
              value={formData.badge || ""}
              onChange={(e) =>
                handleChange("badge", e.target.value || undefined)
              }
              className="dn-input"
            >
              <option value="">No Badge</option>
              <option value="HOT">HOT</option>
              <option value="NEW">NEW</option>
              <option value="BEST_SELLER">BEST SELLER</option>
              <option value="LIMITED">LIMITED</option>
            </select>
          </div>

          {/* Image URL */}
          <div>
            <label className="dn-label-text">Image URL</label>
            <div className="flex gap-2">
              <input
                type="url"
                value={formData.imageUrl || ""}
                onChange={(e) => handleChange("imageUrl", e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="dn-input flex-1"
              />
              <button
                type="button"
                className="flex items-center gap-2 px-4 rounded-lg bg-surface-light border border-border text-text-muted hover:bg-surface-elevated transition-colors"
              >
                <Upload className="h-4 w-4" />
              </button>
            </div>
            {formData.imageUrl && (
              <div className="mt-3">
                <img
                  src={formData.imageUrl}
                  alt="Preview"
                  className="h-32 w-32 object-cover rounded-lg border border-border"
                  onError={(e) => {
                    e.currentTarget.src =
                      "https://placehold.co/200x200/282930/999999?text=Invalid+URL";
                  }}
                />
              </div>
            )}
          </div>

          {/* Toggles */}
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => handleChange("isActive", e.target.checked)}
                className="w-5 h-5 rounded border-border bg-surface-light checked:bg-primary"
              />
              <span className="text-sm text-text">Active</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isFeatured}
                onChange={(e) => handleChange("isFeatured", e.target.checked)}
                className="w-5 h-5 rounded border-border bg-surface-light checked:bg-primary"
              />
              <span className="text-sm text-text">Featured</span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-lg border border-border text-text-muted hover:bg-surface-light transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                "flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-text font-medium transition-all",
                "hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>{isEdit ? "Update" : "Create"} Product</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
