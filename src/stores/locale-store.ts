"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Locale } from "@/lib/i18n";

interface LocaleStore {
  locale: Locale;
  currency: "IDR" | "USD";
  setLocale: (locale: Locale) => void;
  setCurrency: (currency: "IDR" | "USD") => void;
}

export const useLocaleStore = create<LocaleStore>()(
  persist(
    (set) => ({
      locale: "en",
      currency: "IDR",
      setLocale: (locale) => set({ locale }),
      setCurrency: (currency) => set({ currency }),
    }),
    { name: "leiz-locale" }
  )
);
