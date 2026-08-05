/**
 * Shared server-side admin authentication.
 * Supabase Auth is primary; the legacy admin_token JWT is a compatibility path.
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";
import { verifyJWT, extractTokenFromHeader, type JWTPayload } from "@/lib/auth";
import { UnauthorizedError } from "@/lib/errors";

export interface AdminIdentity {
  id: string;
  email: string;
  name?: string | null;
  source: "supabase" | "legacy-jwt";
}

async function getCookieValue(name: string): Promise<string | null> {
  const value = (await cookies()).get(name)?.value;
  return value ? decodeURIComponent(value) : null;
}

async function getLegacyToken(request?: Request): Promise<string | null> {
  const headerToken = request
    ? extractTokenFromHeader(request.headers.get("authorization") || undefined)
    : null;
  if (headerToken) return headerToken;

  const cookieHeader = request?.headers.get("cookie") || "";
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("admin_token="));

  return cookie
    ? decodeURIComponent(cookie.slice("admin_token=".length))
    : getCookieValue("admin_token");
}

async function getSupabaseUser(request?: Request) {
  const authorizationToken = request
    ? extractTokenFromHeader(request.headers.get("authorization") || undefined)
    : null;

  if (authorizationToken) {
    const { data } = await supabaseAdmin.auth.getUser(authorizationToken);
    return data.user || null;
  }

  try {
    const cookieStore = await cookies();
    const client = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => {
            // Do not mutate cookies while checking an API request.
          },
        },
      }
    );
    const { data } = await client.auth.getUser();
    return data.user || null;
  } catch {
    return null;
  }
}

async function findAdminProfile(
  email: string,
  source: AdminIdentity["source"] = "supabase"
): Promise<AdminIdentity | null> {
  const { data, error } = await supabaseAdmin
    .from("user")
    .select("id, email, name, role, is_active")
    .eq("email", email)
    .maybeSingle();

  if (error || !data || data.role !== "ADMIN" || data.is_active === false) {
    return null;
  }

  return { id: data.id, email: data.email, name: data.name, source };
}

/** Return an admin identity, or null when the request is not authorized. */
export async function authenticateAdmin(request?: Request): Promise<AdminIdentity | null> {
  const user = await getSupabaseUser(request);
  if (user?.email) {
    const profile = await findAdminProfile(user.email);
    if (profile) return profile;
  }

  const legacyToken = await getLegacyToken(request);
  if (!legacyToken) return null;

  const payload: JWTPayload | null = verifyJWT(legacyToken);
  if (!payload || payload.role !== "ADMIN" || !payload.email) return null;

  // LOW-1: re-validate the legacy JWT against the database, mirroring the
  // Supabase path above. A legacy token is only honored while its email still
  // maps to an active ADMIN profile, so deactivating an admin (or demoting the
  // role) immediately revokes any outstanding legacy tokens — the JWT payload
  // alone is never trusted. Fails closed when the lookup errors.
  const legacyProfile = await findAdminProfile(payload.email, "legacy-jwt");
  if (!legacyProfile) return null;

  return legacyProfile;
}

export async function isAdminRequest(request?: Request): Promise<boolean> {
  return Boolean(await authenticateAdmin(request));
}

export async function requireAdmin(request: Request): Promise<AdminIdentity> {
  const identity = await authenticateAdmin(request);
  if (!identity) throw new UnauthorizedError();
  return identity;
}
