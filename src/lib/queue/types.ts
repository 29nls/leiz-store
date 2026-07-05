export const JobStatus = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
} as const;
export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

export const JobType = {
  SEND_INVOICE_EMAIL: "SEND_INVOICE_EMAIL",
  SEND_INVOICE_WHATSAPP: "SEND_INVOICE_WHATSAPP",
} as const;
export type JobType = (typeof JobType)[keyof typeof JobType];

export interface Job {
  id: string;
  type: JobType;
  payload: Record<string, unknown>;
  status: JobStatus;
  priority: number;
  retry_count: number;
  max_retries: number;
  last_error?: string | null;
  scheduled_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EnqueueOptions {
  priority?: number;
  maxRetries?: number;
  scheduledAt?: Date;
}
