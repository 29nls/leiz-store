"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem, CartStore } from "@/types";

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      setIsOpen: (open: boolean) => set({ isOpen: open }),

      addItem: (item) =>
        set((state) => {
          const existing = state.items.find((i) => i.productId === item.productId);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.productId === item.productId
                  ? { ...i, quantity: Math.min(i.quantity + 1, item.stock) }
                  : i
              ),
            };
          }
          return {
            items: [...state.items, { ...item, id: crypto.randomUUID(), quantity: 1 }],
          };
        }),

      removeItem: (productId) =>
        set((state) => ({
          items: state.items.filter((i) => i.productId !== productId),
        })),

      updateQuantity: (productId, quantity) =>
        set((state) => ({
          items: quantity <= 0
            ? state.items.filter((i) => i.productId !== productId)
            : state.items.map((i) =>
                i.productId === productId
                  ? { ...i, quantity: Math.min(quantity, i.stock) }
                  : i
              ),
        })),

      clearCart: () => set({ items: [] }),

      getSubtotal: () =>
        get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),

      getTax: () => Math.round(get().getSubtotal() * 0.11),

      getTotal: () => get().getSubtotal() + get().getTax(),

      getItemCount: () =>
        get().items.reduce((sum, item) => sum + item.quantity, 0),
    }),
    { name: "leiz-cart" }
  )
);
