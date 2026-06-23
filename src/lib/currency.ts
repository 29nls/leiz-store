/**
 * Multi-Currency Support
 * Supports IDR (Indonesian Rupiah) and USD (US Dollar)
 */

export type Currency = "IDR" | "USD";

export interface CurrencyConfig {
  code: Currency;
  symbol: string;
  name: string;
  locale: string;
  decimals: number;
}

export const CURRENCIES: Record<Currency, CurrencyConfig> = {
  IDR: {
    code: "IDR",
    symbol: "Rp",
    name: "Indonesian Rupiah",
    locale: "id-ID",
    decimals: 0,
  },
  USD: {
    code: "USD",
    symbol: "$",
    name: "US Dollar",
    locale: "en-US",
    decimals: 2,
  },
};

// Default exchange rate (should be updated via API in production)
const DEFAULT_RATES: Record<string, number> = {
  "IDR_USD": 0.000063,
  "USD_IDR": 15800,
};

// In-memory rate cache
let rateCache: { rates: Record<string, number>; lastFetch: number } = {
  rates: DEFAULT_RATES,
  lastFetch: 0,
};

const RATE_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Fetch latest exchange rates from a free API
 */
export async function fetchExchangeRates(): Promise<Record<string, number>> {
  const now = Date.now();
  if (now - rateCache.lastFetch < RATE_CACHE_TTL_MS) {
    return rateCache.rates;
  }

  try {
    const res = await fetch(
      "https://open.er-api.com/v6/latest/USD"
    );
    if (!res.ok) throw new Error("Failed to fetch rates");
    const data = await res.json();
    const usdToIdr = data.rates?.IDR || 15800;

    rateCache = {
      rates: {
        "IDR_USD": 1 / usdToIdr,
        "USD_IDR": usdToIdr,
      },
      lastFetch: now,
    };

    return rateCache.rates;
  } catch {
    return DEFAULT_RATES;
  }
}

/**
 * Convert amount between currencies
 */
export function convertCurrency(
  amount: number,
  from: Currency,
  to: Currency
): number {
  if (from === to) return amount;
  const rateKey = `${from}_${to}`;
  const rate = rateCache.rates[rateKey] || DEFAULT_RATES[rateKey];
  return Math.round(amount * rate * 100) / 100;
}

/**
 * Format price in the specified currency
 */
export function formatPrice(amount: number, currency: Currency = "IDR"): string {
  const config = CURRENCIES[currency];
  return new Intl.NumberFormat(config.locale, {
    style: "currency",
    currency: config.code,
    minimumFractionDigits: config.decimals,
    maximumFractionDigits: config.decimals,
  }).format(amount);
}

/**
 * Get price in both currencies for a product
 */
export function getDualPrice(
  idrPrice: number,
  preferredCurrency: Currency = "IDR"
): { primary: string; secondary: string; primaryCurrency: Currency; secondaryCurrency: Currency } {
  if (preferredCurrency === "IDR") {
    return {
      primary: formatPrice(idrPrice, "IDR"),
      secondary: formatPrice(convertCurrency(idrPrice, "IDR", "USD"), "USD"),
      primaryCurrency: "IDR",
      secondaryCurrency: "USD",
    };
  }

  return {
    primary: formatPrice(convertCurrency(idrPrice, "IDR", "USD"), "USD"),
    secondary: formatPrice(idrPrice, "IDR"),
    primaryCurrency: "USD",
    secondaryCurrency: "IDR",
  };
}

/**
 * Parse currency string to number
 * Handles formats: "Rp 150.000", "$9.99", "150000", "Rp1.500.000"
 */
export function parseCurrency(value: string): number {
  // Remove currency symbols and whitespace
  let cleaned = value.replace(/[^0-9.,-]/g, "");
  if (!cleaned) return 0;

  // Handle IDR format: dots as thousands separator, no decimals
  // e.g., "Rp 150.000" -> "150000", "Rp1.500.000" -> "1500000"
  if (cleaned.includes(".") && cleaned.includes(",")) {
    // Format like 1.500.000,00 (European style)
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(".")) {
    // Could be 150.000 (IDR with dots as thousands) or 9.99 (USD with decimal)
    const parts = cleaned.split(".");
    if (parts.length === 2 && parts[1].length === 2) {
      // Likely decimal: 9.99 - keep as is
    } else {
      // Likely thousands separator: 150.000 -> 150000
      cleaned = cleaned.replace(/\./g, "");
    }
  }

  return parseFloat(cleaned) || 0;
}
