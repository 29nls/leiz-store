/**
 * Payment Flow Constants
 * Payment accounts, state machine transitions, and expiry config
 */

// ─── Payment Expiry ──────────────────────────────────────────

/** Default payment expiry in milliseconds (24 hours) */
export const PAYMENT_EXPIRY_MS = 24 * 60 * 60 * 1000;

// ─── Manual Payment Accounts ────────────────────────────────

export interface PaymentAccount {
  method: string;
  label: string;
  icon: string;
  accountName: string;
  accountNumber: string;
  bankName?: string;
}

export const PAYMENT_ACCOUNTS: PaymentAccount[] = [
  {
    method: "bank_transfer",
    label: "Bank Transfer (BCA)",
    icon: "🏦",
    accountName: "LEIZ STORE",
    accountNumber: "1234567890",
    bankName: "BCA",
  },
  {
    method: "gopay",
    label: "GoPay",
    icon: "💚",
    accountName: "LEIZ STORE",
    accountNumber: "08123456789",
  },
  {
    method: "dana",
    label: "DANA",
    icon: "💙",
    accountName: "LEIZ STORE",
    accountNumber: "08123456789",
  },
  {
    method: "seabank",
    label: "SeaBank",
    icon: "🔵",
    accountName: "LEIZ STORE",
    accountNumber: "9876543210",
    bankName: "SeaBank",
  },
];

export function getPaymentAccount(method: string): PaymentAccount | undefined {
  return PAYMENT_ACCOUNTS.find((a) => a.method === method);
}

// ─── State Machine ──────────────────────────────────────────

/**
 * Valid status transitions for the manual payment flow.
 * Key = current status, value = array of allowed next statuses.
 */
export const STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["PENDING_PAYMENT", "CANCELLED"],
  PENDING_PAYMENT: ["WAITING_CONFIRMATION", "EXPIRED", "CANCELLED", "FORCE_CANCELLED"],
  WAITING_PAYMENT: ["PAID", "CANCELLED", "EXPIRED"],
  WAITING_CONFIRMATION: ["PAID", "REJECTED", "NEEDS_REVIEW", "CANCELLED", "FORCE_CANCELLED", "EXPIRED"],
  PAID: ["PROCESSING", "COMPLETED"],
  PROCESSING: ["COMPLETED", "CANCELLED"],
  NEEDS_REVIEW: ["WAITING_CONFIRMATION", "PAID", "CANCELLED", "FORCE_CANCELLED"],
  REJECTED: ["WAITING_CONFIRMATION", "CANCELLED", "FORCE_CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  FORCE_CANCELLED: [],
  REFUNDED: [],
  EXPIRED: [],
};

/**
 * Check whether a status transition is valid.
 */
export function isValidTransition(from: string, to: string): boolean {
  const allowed = STATUS_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

// ─── Manual Payment Methods ─────────────────────────────────

export const MANUAL_PAYMENT_METHODS = ["bank_transfer", "gopay", "dana", "seabank"] as const;
export type ManualPaymentMethod = (typeof MANUAL_PAYMENT_METHODS)[number];

export function isManualPaymentMethod(method: string): method is ManualPaymentMethod {
  return (MANUAL_PAYMENT_METHODS as readonly string[]).includes(method);
}
