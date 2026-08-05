export const InvoiceStatus = {
  PENDING: "PENDING",
  SENT: "SENT",
  FAILED: "FAILED",
} as const;
export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

/** Email delivery sub-state stored in invoice.email_status. */
export const InvoiceEmailStatus = {
  PENDING: "PENDING",
  SENT: "SENT",
  SKIPPED: "SKIPPED",
  FAILED: "FAILED",
} as const;
export type InvoiceEmailStatus = (typeof InvoiceEmailStatus)[keyof typeof InvoiceEmailStatus];

export interface Invoice {
  id: string;
  order_id: string;
  invoice_no: string;
  status: InvoiceStatus;
  /** Legacy signed URL; do not use as a permanent storage reference. */
  pdf_url?: string | null;
  /** Permanent private-storage path used to create fresh signed URLs. */
  pdf_path?: string | null;
  /** Email delivery sub-state; see InvoiceEmailStatus. */
  email_status?: InvoiceEmailStatus | null;
  /** True once the invoice email was actually delivered. */
  sent_via_email?: boolean | null;
  error_log?: Record<string, unknown> | null;
  store_id?: string | null;
  created_at: string;
  updated_at: string;
  sent_at?: string | null;
}

export interface InvoiceData {
  invoiceNo: string;
  orderNumber: string;
  customerName: string;
  /** Buyer email from order.customer_email; used as the invoice recipient. */
  customerEmail?: string;
  customerDiscord?: string;
  customerIGN?: string;
  items: InvoiceItemData[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  currency: string;
  paymentMethod: string;
  paymentRef?: string;
  createdAt: string;
  paidAt?: string;
  storeName?: string;
  storeAddress?: string;
}

export interface InvoiceItemData {
  name: string;
  quantity: number;
  price: number;
  total: number;
}

export interface InvoiceResult {
  success: boolean;
  invoiceNo?: string;
  error?: string;
  /**
   * Email delivery outcome:
   * - SENT: delivered via SMTP.
   * - SKIPPED: intentionally not sent (no buyer email or SMTP unconfigured) —
   *   terminal, do not retry automatically.
   * - FAILED: SMTP send failed — retryable (queue retries + admin resend).
   * When emailStatus is SKIPPED, `success` is still false because the email
   * was NOT sent; callers decide whether the job is terminal based on
   * emailStatus, not on success alone.
   */
  emailStatus?: "SENT" | "SKIPPED" | "FAILED";
}
