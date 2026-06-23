import { NextResponse } from "next/server";
import { clearAuthCookie } from "@/lib/auth-secure";

export async function POST() {
  try {
    // Clear auth cookie
    await clearAuthCookie();

    return NextResponse.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to logout" },
      { status: 500 }
    );
  }
}
