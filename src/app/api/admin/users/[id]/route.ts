/**
 * Admin Users API — Single User Operations
 *
 * GET    /api/admin/users/[id]  — Get user details
 * PATCH  /api/admin/users/[id]  — Update user (name, role, active)
 * DELETE /api/admin/users/[id]  — Deactivate user (soft delete)
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";

// ─── GET: Get user details ────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(req);
    const { id } = await params;

    const { data: user, error } = await supabaseAdmin
      .from("user")
      .select("id, email, name, role, avatar, discord, phone, is_active, last_login_at, created_at, updated_at")
      .eq("id", id)
      .single();

    if (error || !user) {
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to get user" }, { status: 500 });
  }
}

// ─── PATCH: Update user ───────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(req);
    const { id } = await params;
    const body = await req.json();
    const { name, role, discord, phone, is_active, password } = body;

    // Verify user exists
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("user")
      .select("id, email")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
    }

    // Validate role
    if (role && !["ADMIN", "CUSTOMER"].includes(role)) {
      return NextResponse.json({ error: "Role tidak valid" }, { status: 400 });
    }

    // Build update payload
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (name !== undefined) updatePayload.name = name;
    if (role !== undefined) updatePayload.role = role;
    if (discord !== undefined) updatePayload.discord = discord || null;
    if (phone !== undefined) updatePayload.phone = phone || null;
    if (is_active !== undefined) updatePayload.is_active = is_active;

    // Update public.user table
    const { error: upError } = await supabaseAdmin
      .from("user")
      .update(updatePayload)
      .eq("id", id);

    if (upError) throw upError;

    // If password is being changed, update Supabase Auth
    if (password && password.length >= 6) {
      // Find the auth user by email
      const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
      const authUser = authUsers?.users?.find((u) => u.email === existing.email);
      if (authUser) {
        const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(
          authUser.id,
          { password }
        );
        if (pwError) throw pwError;
      }
    }

    // If reactivating, unban the user in Supabase Auth
    if (is_active === true) {
      const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
      const authUser = authUsers?.users?.find((u) => u.email === existing.email);
      if (authUser) {
        await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
          ban_duration: "0",
        });
      }
    }

    return NextResponse.json({
      message: "User berhasil diperbarui",
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to update user" }, { status: 500 });
  }
}

// ─── DELETE: Deactivate user (soft delete) ────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(req);
    const { id } = await params;

    // Verify user exists
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("user")
      .select("id, email, role")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
    }

    // Prevent deactivating the last admin
    if (existing.role === "ADMIN") {
      const { count } = await supabaseAdmin
        .from("user")
        .select("id", { count: "exact", head: true })
        .eq("role", "ADMIN")
        .eq("is_active", true);

      if ((count || 0) <= 1) {
        return NextResponse.json(
          { error: "Tidak dapat menonaktifkan admin terakhir" },
          { status: 400 }
        );
      }
    }

    // Soft delete: set is_active = false
    const { error: upError } = await supabaseAdmin
      .from("user")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (upError) throw upError;

    // Also ban the user in Supabase Auth to prevent login
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
    const authUser = authUsers?.users?.find((u) => u.email === existing.email);
    if (authUser) {
      // Ban for 100 years (effectively permanent until unbanned)
      await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
        ban_duration: "36500d",
      });
    }

    return NextResponse.json({
      message: "User berhasil dinonaktifkan",
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to deactivate user" }, { status: 500 });
  }
}
