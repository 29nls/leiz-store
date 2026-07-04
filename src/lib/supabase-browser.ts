"use client";

import { createClient } from "@supabase/supabase-js";
import { useMemo } from "react";

function createBrowserClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
      global: {
        headers: {
          "x-application-name": "leiz-store",
        },
      },
    }
  );
}

let cached: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowser() {
  if (!cached) {
    cached = createBrowserClient();
  }
  return cached;
}

export function useSupabase() {
  return useMemo(() => getSupabaseBrowser(), []);
}

/**
 * Subscribe to real-time changes on a table
 */
export function subscribeToTable(
  table: string,
  callback: (payload: any) => void,
  event: "INSERT" | "UPDATE" | "DELETE" | "*" = "*"
) {
  const supabase = getSupabaseBrowser();
  const channel = supabase
    .channel(`admin-${table}-changes`)
    .on(
      "postgres_changes",
      { event, schema: "public", table },
      (payload) => {
        callback(payload);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Subscribe to real-time changes on a specific row (filtered by column=value)
 * Uses a unique channel name to avoid conflicts between multiple subscribers.
 */
export function subscribeToRow(
  table: string,
  filter: string,
  callback: (payload: any) => void,
  event: "INSERT" | "UPDATE" | "DELETE" | "*" = "*",
  channelName?: string
) {
  const supabase = getSupabaseBrowser();
  const name = channelName || `${table}-${filter.replace(/[=.,]/g, "-")}-${Math.random().toString(36).slice(2, 8)}`;
  const channel = supabase
    .channel(name)
    .on(
      "postgres_changes",
      { event, schema: "public", table, filter },
      (payload) => {
        callback(payload);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
