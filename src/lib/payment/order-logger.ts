/**
 * Order Logger
 * Records all order status changes to the order_log table
 */

import { supabaseAdmin } from "@/lib/supabase";

export type ActorType = "SYSTEM" | "BUYER" | "ADMIN";

interface LogEntry {
  orderId: string;
  actorType: ActorType;
  actorId?: string;
  action: string;
  previousStatus?: string;
  newStatus?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log an order status change to the order_log table.
 * Uses supabaseAdmin to bypass RLS.
 */
export async function logOrderStatusChange(entry: LogEntry): Promise<void> {
  const { error } = await supabaseAdmin.from("order_log").insert({
    order_id: entry.orderId,
    actor_type: entry.actorType,
    actor_id: entry.actorId || null,
    action: entry.action,
    previous_status: entry.previousStatus || null,
    new_status: entry.newStatus || null,
    metadata: entry.metadata || {},
  });

  if (error) {
    console.error("[OrderLogger] Failed to log status change:", error.message, entry);
  }
}
