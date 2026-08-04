/** Canonical order pricing used by both UI and server-side checkout. */
export const ORDER_TAX_RATE = 0.11;

export interface OrderTotals {
  subtotal: number;
  tax: number;
  total: number;
}

export function calculateOrderTotals(subtotal: number): OrderTotals {
  const normalizedSubtotal = Math.max(0, Math.round(Number(subtotal) || 0));
  const tax = Math.round(normalizedSubtotal * ORDER_TAX_RATE);
  return {
    subtotal: normalizedSubtotal,
    tax,
    total: normalizedSubtotal + tax,
  };
}
