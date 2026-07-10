"use client";

import Link from "next/link";
import { Heart, ShoppingBag, ArrowRight } from "@/components/ui/icons";

export default function WishlistPage() {
  return (
    <main className="min-h-screen flex items-center justify-center py-12">
      <div className="text-center max-w-md mx-auto px-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-surface mb-6 mx-auto">
          <Heart className="h-10 w-10 text-text-secondary" />
        </div>
        <h1 className="text-2xl font-bold text-text mb-2">Your Wishlist</h1>
        <p className="text-text-secondary mb-8">
          Nothing here yet — tap the heart on any item to save it for later.
        </p>
        <Link
          href="/products"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-sm font-semibold text-white hover:bg-ember-bright shadow-ember/30 transition-all"
        >
          <ShoppingBag className="h-4 w-4" />
          Browse Products
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </main>
  );
}
