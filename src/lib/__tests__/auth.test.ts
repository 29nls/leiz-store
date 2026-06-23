import {
  signJWT,
  verifyJWT,
  hashPassword,
  verifyPassword,
  generateRefreshToken,
  extractTokenFromHeader,
} from "@/lib/auth";

describe("Auth Utilities", () => {
  describe("JWT Signing and Verification", () => {
    const payload = {
      sub: "user-123",
      email: "test@example.com",
      role: "CUSTOMER",
    };

    it("should sign and verify a valid JWT", () => {
      const token = signJWT(payload);
      const verified = verifyJWT(token);

      expect(verified).not.toBeNull();
      expect(verified?.sub).toBe(payload.sub);
      expect(verified?.email).toBe(payload.email);
      expect(verified?.role).toBe(payload.role);
      expect(verified?.iat).toBeDefined();
      expect(verified?.exp).toBeDefined();
    });

    it("should include storeId when provided", () => {
      const token = signJWT({ ...payload, storeId: "store-456" });
      const verified = verifyJWT(token);

      expect(verified?.storeId).toBe("store-456");
    });

    it("should return null for invalid token", () => {
      const result = verifyJWT("invalid.token.here");
      expect(result).toBeNull();
    });

    it("should return null for tampered token", () => {
      const token = signJWT(payload);
      const tampered = token.slice(0, -5) + "XXXXX";
      const result = verifyJWT(tampered);
      expect(result).toBeNull();
    });

    it("should return null for empty string", () => {
      expect(verifyJWT("")).toBeNull();
    });

    it("should return null for malformed token (2 parts)", () => {
      expect(verifyJWT("only.two")).toBeNull();
    });

    it("should return null for malformed token (4+ parts)", () => {
      expect(verifyJWT("a.b.c.d")).toBeNull();
    });

    it("should return null for tokens with invalid JSON in body", () => {
      const { signJWT: sign } = jest.requireActual("@/lib/auth");
      // Create a token with invalid base64 body
      const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid-body.signature";
      expect(verifyJWT(token)).toBeNull();
    });

    it("should return null for expired token", () => {
      jest.useFakeTimers();
      const token = signJWT(payload);
      // Advance past 24h expiry
      jest.advanceTimersByTime(25 * 60 * 60 * 1000);
      expect(verifyJWT(token)).toBeNull();
      jest.useRealTimers();
    });

    it("should produce different tokens for different payloads", () => {
      const token1 = signJWT({ ...payload, sub: "user-1" });
      const token2 = signJWT({ ...payload, sub: "user-2" });
      expect(token1).not.toBe(token2);
    });

    it("should produce different tokens for same payload (different iat)", () => {
      jest.useFakeTimers();
      const token1 = signJWT(payload);
      // Advance time to ensure different iat
      jest.advanceTimersByTime(1000);
      const token2 = signJWT(payload);
      expect(token1).not.toBe(token2);
      jest.useRealTimers();
    });

    it("should handle special characters in payload", () => {
      const token = signJWT({
        ...payload,
        email: "test+special@example.com",
      });
      const verified = verifyJWT(token);
      expect(verified?.email).toBe("test+special@example.com");
    });
  });

  describe("Password Hashing", () => {
    it("should hash a password", async () => {
      const password = "securePassword123!";
      const hashed = await hashPassword(password);

      expect(hashed).not.toBe(password);
      expect(hashed).toContain(":");
      const [salt, hash] = hashed.split(":");
      expect(salt).toHaveLength(32);
      expect(hash).toHaveLength(128);
    });

    it("should verify a correct password", async () => {
      const password = "mySecurePass!";
      const hashed = await hashPassword(password);
      const isValid = await verifyPassword(password, hashed);

      expect(isValid).toBe(true);
    });

    it("should reject an incorrect password", async () => {
      const password = "mySecurePass!";
      const hashed = await hashPassword(password);
      const isValid = await verifyPassword("wrongPassword", hashed);

      expect(isValid).toBe(false);
    });

    it("should produce different hashes for same password (different salts)", async () => {
      const password = "samePassword";
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
      // But both should verify correctly
      expect(await verifyPassword(password, hash1)).toBe(true);
      expect(await verifyPassword(password, hash2)).toBe(true);
    });

    it("should handle empty password", async () => {
      const hashed = await hashPassword("");
      const isValid = await verifyPassword("", hashed);
      expect(isValid).toBe(true);
    });

    it("should handle very long passwords", async () => {
      const longPassword = "a".repeat(1000);
      const hashed = await hashPassword(longPassword);
      const isValid = await verifyPassword(longPassword, hashed);
      expect(isValid).toBe(true);
    });

    it("should handle unicode passwords", async () => {
      const unicodePassword = "pässwörd🚀";
      const hashed = await hashPassword(unicodePassword);
      const isValid = await verifyPassword(unicodePassword, hashed);
      expect(isValid).toBe(true);
    });
  });

  describe("Refresh Token", () => {
    it("should generate a random refresh token", () => {
      const token1 = generateRefreshToken();
      const token2 = generateRefreshToken();

      expect(token1).toBeDefined();
      expect(token2).toBeDefined();
      expect(token1).not.toBe(token2);
      expect(token1).toHaveLength(80); // 40 bytes hex = 80 chars
    });

    it("should always generate unique tokens", () => {
      const tokens = new Set(Array.from({ length: 100 }, generateRefreshToken));
      expect(tokens.size).toBe(100);
    });

    it("should only contain hex characters", () => {
      const token = generateRefreshToken();
      expect(token).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe("extractTokenFromHeader", () => {
    it("should extract token from Bearer header", () => {
      const token = extractTokenFromHeader("Bearer abc123");
      expect(token).toBe("abc123");
    });

    it("should return null for missing header", () => {
      expect(extractTokenFromHeader(undefined)).toBeNull();
    });

    it("should return null for non-Bearer header", () => {
      expect(extractTokenFromHeader("Basic abc123")).toBeNull();
    });

    it("should return null for malformed header (no token)", () => {
      expect(extractTokenFromHeader("Bearer")).toBeNull();
    });

    it("should return null for empty string", () => {
      expect(extractTokenFromHeader("")).toBeNull();
    });

    it("should extract token with special characters", () => {
      const token = extractTokenFromHeader("Bearer eyJhbGciOiJIUzI1NiJ9.eyJ0ZXN0IjoiZGF0YSJ9.signature");
      expect(token).toBe("eyJhbGciOiJIUzI1NiJ9.eyJ0ZXN0IjoiZGF0YSJ9.signature");
    });

    it("should handle multiple spaces gracefully", () => {
      const result = extractTokenFromHeader("Bearer  valid-token");
      // The function splits on space and expects exactly 2 parts
      // With double spaces, we get "Bearer" and "" and "valid-token" (3 parts)
      // So it returns null - that's the current behavior
      expect(result).toBeNull();
    });

    it("should handle lowercase bearer", () => {
      expect(extractTokenFromHeader("bearer token123")).toBeNull();
    });
  });

  describe("Security Edge Cases", () => {
    it("should not accept tokens with null algorithm", () => {
      const result = verifyJWT(
        "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxMjM0NTY3ODkwIn0."
      );
      expect(result).toBeNull();
    });

    it("should detect signature tampering in payload section", () => {
      const token = signJWT({ sub: "user-1", email: "a@b.com", role: "CUSTOMER" });
      const [header, , signature] = token.split(".");
      const tamperedPayload = Buffer.from(
        JSON.stringify({ sub: "user-2", email: "user2@hack.com", role: "CUSTOMER" })
      ).toString("base64url");
      const forged = `${header}.${tamperedPayload}.${signature}`;
      expect(verifyJWT(forged)).toBeNull();
    });
  });
});
