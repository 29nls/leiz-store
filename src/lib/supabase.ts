/**
 * Supabase Client Configuration
 * Provides server-side and client-side Supabase instances
 *
 * LAZY INITIALIZATION: Clients are created on first access, not at module-load
 * time. This is critical because `next build` evaluates this module with
 * NODE_ENV=production but without runtime env vars (Supabase URL/keys are only
 * available at runtime on Vercel). Eager initialization would crash the build.
 *
 * The Proxy pattern makes the laziness transparent — callers use
 * `supabaseAdmin.from("order")` exactly as before; the first property access
 * triggers client creation + env-var validation.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ─── Lazy supabase (public/anon) ──────────────────────────────────────────

let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing Supabase environment variables. " +
      "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  _supabase = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return _supabase;
}

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_, prop, receiver) {
    return Reflect.get(getSupabase(), prop, receiver);
  },
});

// ─── Lazy supabaseAdmin (service role) ────────────────────────────────────

let _supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (_supabaseAdmin) return _supabaseAdmin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable.");
  }
  if (!key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable.");
  }

  _supabaseAdmin = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return _supabaseAdmin;
}

export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_, prop, receiver) {
    return Reflect.get(getSupabaseAdmin(), prop, receiver);
  },
});

export default supabase;
