import { storageService, generateProductImageKey } from "@/lib/storage";

describe("Storage Service", () => {
  describe("isConfigured", () => {
    it("should return false when env vars are missing", () => {
      delete process.env.S3_ENDPOINT;
      delete process.env.S3_BUCKET;
      delete process.env.S3_ACCESS_KEY;
      delete process.env.S3_SECRET_KEY;

      expect(storageService.isConfigured()).toBe(false);
    });

    it("should return true when all env vars are set", () => {
      process.env.S3_ENDPOINT = "https://s3.example.com";
      process.env.S3_BUCKET = "my-bucket";
      process.env.S3_ACCESS_KEY = "access-key";
      process.env.S3_SECRET_KEY = "secret-key";

      expect(storageService.isConfigured()).toBe(true);

      delete process.env.S3_ENDPOINT;
      delete process.env.S3_BUCKET;
      delete process.env.S3_ACCESS_KEY;
      delete process.env.S3_SECRET_KEY;
    });
  });

  describe("generateProductImageKey", () => {
    it("should generate a product image key", () => {
      const key = generateProductImageKey("prod-123", "image.jpg", 0);
      expect(key).toBe("products/prod-123/0-image.jpg");
    });

    it("should handle special characters in filename", () => {
      const key = generateProductImageKey("prod-123", "My Image (1).png", 1);
      expect(key).toContain("products/prod-123/1-");
      expect(key).toContain(".png");
    });

    it("should default to jpg extension", () => {
      const key = generateProductImageKey("prod-123", "noext", 0);
      expect(key).toContain(".jpg");
    });
  });

  describe("uploadFile", () => {
    it("should throw when not configured", async () => {
      delete process.env.S3_ENDPOINT;
      delete process.env.S3_BUCKET;

      await expect(
        storageService.uploadFile({
          key: "test.jpg",
          contentType: "image/jpeg",
          body: Buffer.from("test"),
        })
      ).rejects.toThrow("S3 storage not configured");
    });
  });

  describe("deleteFile", () => {
    it("should throw when not configured", async () => {
      delete process.env.S3_ENDPOINT;
      delete process.env.S3_BUCKET;

      await expect(storageService.deleteFile("test.jpg")).rejects.toThrow(
        "S3 storage not configured"
      );
    });
  });
});