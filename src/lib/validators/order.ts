/**
 * Order Validators
 * Zod schemas for server-side validation of payment flow requests
 */

import { z } from "zod";
import { isValidPaymentToken } from "@/lib/payment/confirmation-token";
import { MANUAL_PAYMENT_METHODS } from "@/lib/payment/constants";

// ─── Order Creation ─────────────────────────────────────────

export const createOrderSchema = z.object({
  customerName: z.string().min(1, "Name is required").max(100),
  customerDiscord: z.string().min(1, "Discord ID is required").max(100).refine(isValidDiscordId, {
    message: "Discord ID tidak valid. Masukkan User ID numerik (17-19 digit) atau username Discord.",
  }),
  customerIGN: z.string().max(100).optional().or(z.literal("")),
  customerNotes: z.string().max(500).optional().or(z.literal("")),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1).max(999),
      })
    )
    .min(1, "At least one item is required")
    // Cap distinct line items so a single request can't make the atomic RPC
    // lock/re-select an unbounded number of product rows (row-lock DoS).
    // 20 is well above any realistic cart for this catalog.
    .max(20, "Maximum 20 items per order"),
  // Close the data model: only the payment methods the store actually
  // supports (PAYMENT_ACCOUNTS) are accepted.
  paymentMethod: z.enum([...MANUAL_PAYMENT_METHODS], {
    message: "Payment method tidak didukung",
  }),
  currency: z.string().optional().default("IDR"),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

// ─── Confirm Transfer ───────────────────────────────────────

export const confirmTransferSchema = z.object({
  buyerName: z.string().min(1, "Name is required").max(100),
  buyerDiscordId: z.string().min(1, "Discord ID is required").max(100).refine(isValidDiscordId, {
    message: "Discord ID tidak valid. Masukkan User ID numerik (17-19 digit) atau username Discord.",
  }),
  confirmationToken: z.string().optional().refine(
    (value) => value === undefined || isValidPaymentToken(value),
    { message: "Confirmation token tidak valid." }
  ),
  note: z.string().max(500).optional(),
});

export type ConfirmTransferInput = z.infer<typeof confirmTransferSchema>;

// ─── Admin Payment Action ───────────────────────────────────

export const adminPaymentActionSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  action: z.enum(["accept", "reject", "cancel", "force_cancel"]),
});

export type AdminPaymentActionInput = z.infer<typeof adminPaymentActionSchema>;

// ─── Discord ID Validation ──────────────────────────────────

/**
 * Validates that a string looks like a Discord user ID (numeric, 17-19 digits)
 * or a Discord username (username#discriminator or new format).
 */
export function isValidDiscordId(value: string): boolean {
  if (!value) return false;
  // Numeric snowflake ID (17-19 digits)
  if (/^\d{17,19}$/.test(value)) return true;
  // Username#discriminator format
  if (/^.{2,32}#\d{4}$/.test(value)) return true;
  // New username format (2-32 chars, alphanumeric + dots + underscores)
  if (/^[a-zA-Z0-9_.]{2,32}$/.test(value)) return true;
  return false;
}
