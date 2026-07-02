import crypto from "crypto";

// JWT utilities (pure implementation - no external dependency needed)
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET environment variable is required in production");
  }
  console.warn("⚠️  JWT_SECRET not set. Using default for development only.");
}
const SECRET = JWT_SECRET || "leiz-store-dev-secret-key-change-in-production";
const JWT_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const _REFRESH_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function base64UrlEncode(data: string): string {
  return Buffer.from(data)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(data: string): string {
  let base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf-8");
}

function hmacSign(data: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(data).digest("base64url");
}

export interface JWTPayload {
  sub: string;
  email: string;
  role: string;
  storeId?: string;
  iat: number;
  exp: number;
}

export function signJWT(payload: Omit<JWTPayload, "iat" | "exp">): string {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const body = base64UrlEncode(
    JSON.stringify({
      ...payload,
      iat: now,
      exp: now + JWT_EXPIRY_MS / 1000,
    })
  );
  const signature = hmacSign(`${header}.${body}`, SECRET);
  return `${header}.${body}.${signature}`;
}

export function verifyJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [header, body, signature] = parts;
    const expectedSig = hmacSign(`${header}.${body}`, SECRET);

    if (signature !== expectedSig) return null;

    const payload = JSON.parse(base64UrlDecode(body)) as JWTPayload;
    if (payload.exp * 1000 < Date.now()) return null;

    return payload;
  } catch {
    return null;
  }
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(40).toString("hex");
}

// Simple password hashing with PBKDF2 (no bcrypt dependency needed)
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEY_LENGTH = 64;
const PBKDF2_DIGEST = "sha512";

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(
      password,
      salt,
      PBKDF2_ITERATIONS,
      PBKDF2_KEY_LENGTH,
      PBKDF2_DIGEST,
      (err, derivedKey) => {
        if (err) reject(err);
        resolve(`${salt}:${derivedKey.toString("hex")}`);
      }
    );
  });
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  const [salt, hash] = hashedPassword.split(":");
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(
      password,
      salt,
      PBKDF2_ITERATIONS,
      PBKDF2_KEY_LENGTH,
      PBKDF2_DIGEST,
      (err, derivedKey) => {
        if (err) reject(err);
        resolve(derivedKey.toString("hex") === hash);
      }
    );
  });
}

export function extractTokenFromHeader(
  authorization: string | undefined
): string | null {
  if (!authorization) return null;
  const parts = authorization.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;
  return parts[1];
}
