export const InvoiceStatus = {
  PENDING: "PENDING",
  SENT: "SENT",
  FAILED: "FAILED",
} as const;
export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

export const SendStatus = {
  PENDING: "PENDING",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
} as const;
export type SendStatus = (typeof SendStatus)[keyof typeof SendStatus];

export interface Invoice {
  id: string;
  order_id: string;
  invoice_no: string;
  status: InvoiceStatus;
  /** Legacy signed URL; do not use as a permanent storage reference. */
  pdf_url?: string | null;
  /** Permanent private-storage path used to create fresh signed URLs. */
  pdf_path?: string | null;
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
}
