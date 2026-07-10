export interface StatusStyle {
  label: string;
  color: string;
  bg: string;
  border: string;
}

export const STATUS_COLORS: Record<string, StatusStyle> = {
  PENDING: { label: "Pending", color: "text-warning", bg: "bg-warning/15", border: "border-warning/20" },
  PENDING_PAYMENT: { label: "Awaiting Payment", color: "text-warning", bg: "bg-warning/15", border: "border-warning/20" },
  WAITING_PAYMENT: { label: "Awaiting Payment", color: "text-warning", bg: "bg-warning/15", border: "border-warning/20" },
  WAITING_CONFIRMATION: { label: "Awaiting Verification", color: "text-warning", bg: "bg-warning/15", border: "border-warning/20" },
  NEEDS_REVIEW: { label: "Needs Review", color: "text-warning", bg: "bg-warning/15", border: "border-warning/20" },
  PAID: { label: "Payment Confirmed", color: "text-success", bg: "bg-success/15", border: "border-success/20" },
  COMPLETED: { label: "Completed", color: "text-success", bg: "bg-success/15", border: "border-success/20" },
  CANCELLED: { label: "Cancelled", color: "text-error", bg: "bg-error/15", border: "border-error/20" },
  EXPIRED: { label: "Expired", color: "text-error", bg: "bg-error/15", border: "border-error/20" },
  REJECTED: { label: "Payment Rejected", color: "text-error", bg: "bg-error/15", border: "border-error/20" },
  FORCE_CANCELLED: { label: "Cancelled by Admin", color: "text-error", bg: "bg-error/15", border: "border-error/20" },
  PROCESSING: { label: "Processing", color: "text-arcane", bg: "bg-arcane/15", border: "border-arcane/20" },
  REFUNDED: { label: "Refunded", color: "text-text-secondary", bg: "bg-surface-raised", border: "border-border" },
};

const DEFAULT_STATUS_STYLE: StatusStyle = {
  label: "Unknown",
  color: "text-text-secondary",
  bg: "bg-surface-raised",
  border: "border-border",
};

export function getStatusStyle(status: string): StatusStyle {
  if (!status) return DEFAULT_STATUS_STYLE;
  return STATUS_COLORS[status.toUpperCase()] || DEFAULT_STATUS_STYLE;
}

/** Full badge className (bg + text + border) for order status pills. */
export function getStatusBadge(status: string): string {
  const s = getStatusStyle(status);
  return `${s.bg} ${s.color} ${s.border}`;
}

/** Invoice-specific statuses (separate domain from order status). */
export const INVOICE_STATUS_COLORS: Record<string, StatusStyle> = {
  PENDING: { label: "Pending", color: "text-warning", bg: "bg-warning/15", border: "border-warning/20" },
  SENT: { label: "Sent", color: "text-success", bg: "bg-success/15", border: "border-success/20" },
  FAILED: { label: "Failed", color: "text-error", bg: "bg-error/15", border: "border-error/20" },
};

export function getInvoiceStatusBadge(status: string): string {
  const s = INVOICE_STATUS_COLORS[status?.toUpperCase()] || DEFAULT_STATUS_STYLE;
  return `${s.bg} ${s.color} ${s.border}`;
}
