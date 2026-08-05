import crypto from "crypto";

// JWT utilities (pure implementation - no external dependency needed)
//
// Lazy secret resolution: we resolve JWT_SECRET on first access rather than at
// module-load time. This is critical because during `next build` Next.js sets
// NODE_ENV=production and evaluates route modules to collect page data. The
// build environment does NOT have runtime env vars like JWT_SECRET, so throwing
// eagerly at the top level would crash the build with
//   "JWT_SECRET environment variable is required in production"
// Auth functions (sign/verify) are never invoked during build, so deferring the
// check to call time is both safe and necessary.

const JWT_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const _REFRESH_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

let cachedSecret: string | null = null;

function getSecret(): string {
  if (cachedSecret !== null) return cachedSecret;

  const envSecret = process.env.JWT_SECRET;
  if (envSecret) {
    cachedSecret = envSecret;
    return cachedSecret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "JWT_SECRET environment variable is required in production. " +
      "Set it in your hosting environment (e.g. Vercel dashboard)."
    );
  }

  console.warn("⚠️  JWT_SECRET not set. Using default for development only.");
  cachedSecret = "leiz-store-dev-secret-key-change-in-production";
  return cachedSecret;
}

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

/**
 * Constant-time string comparison for signatures/secrets (LOW-1).
 *
 * Length is checked before crypto.timingSafeEqual because the latter throws on
 * mismatched buffer lengths. For HMAC-SHA256 base64url signatures both sides
 * are always 43 ASCII characters, so the length check leaks nothing an
 * attacker does not already know.
 */
function safeEqualStrings(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
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
  const signature = hmacSign(`${header}.${body}`, getSecret());
  return `${header}.${body}.${signature}`;
}

export function verifyJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [header, body, signature] = parts;
    const expectedSig = hmacSign(`${header}.${body}`, getSecret());

    // LOW-1: constant-time comparison. A `!==` string compare exits early on
    // the first differing byte, leaking signature information via timing.
    if (!safeEqualStrings(signature, expectedSig)) return null;

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
