import { NextRequest, NextResponse } from "next/server";
import { verifyCredentials, generateToken, setAuthCookie } from "@/lib/auth-secure";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password } = body;

    // Validate input
    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: "Username and password are required" },
        { status: 400 }
      );
    }

    // Verify credentials (bcrypt password check)
    const user = await verifyCredentials(username, password);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Invalid username or password" },
        { status: 401 }
      );
    }

    // Generate JWT token
    const token = generateToken(user);

    // Set httpOnly cookie
    await setAuthCookie(token);

    // Return success with user info (no token in response for security)
    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
