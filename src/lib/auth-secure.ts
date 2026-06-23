import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.NEXTAUTH_SECRET || "your-super-secret-key-minimum-32-characters";
const TOKEN_EXPIRY = "24h";

export interface AdminUser {
  id: string;
  username: string;
  name: string;
  email: string;
  role: string;
}

// Admin users with HASHED passwords (bcrypt)
// Generated with: bcrypt.hash("admin123", 10)
const ADMIN_USERS: Array<AdminUser & { password: string }> = [
  {
    id: "1",
    username: "admin",
    name: "Administrator",
    email: "admin@leizstore.com",
    password: "$2b$10$7KJo3kpMcNhau39WvCseZObfSEhSmp.PXX1AJPpMBtKMwlQqQVTFy", // admin123
    role: "admin",
  },
];

export async function verifyCredentials(
  username: string,
  password: string
): Promise<AdminUser | null> {
  // Support both username and email login
  const user = ADMIN_USERS.find((u) => u.username === username || u.email === username);

  if (!user) {
    return null;
  }

  const isValid = await bcrypt.compare(password, user.password);

  if (!isValid) {
    return null;
  }

  // Return user without password
  const { password: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

export function generateToken(user: AdminUser): string {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

export function verifyToken(token: string): AdminUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return {
      id: decoded.id,
      username: decoded.username,
      name: decoded.name || decoded.username,
      email: decoded.email || "",
      role: decoded.role,
    };
  } catch {
    return null;
  }
}

export async function setAuthCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set("admin_auth_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 24 * 60 * 60, // 24 hours
    path: "/",
  });
}

export async function clearAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete("admin_auth_token");
}

export async function getAuthToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("admin_auth_token")?.value || null;
}

export async function getCurrentUser(): Promise<AdminUser | null> {
  const token = await getAuthToken();
  if (!token) return null;
  return verifyToken(token);
}
