import {
  AppError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  RateLimitError,
  successResponse,
  errorResponse,
  buildMeta,
} from "@/lib/errors";

describe("Error Utilities", () => {
  describe("AppError", () => {
    it("should create an error with status code and code", () => {
      const error = new AppError(400, "BAD_REQUEST", "Bad request");
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe("BAD_REQUEST");
      expect(error.message).toBe("Bad request");
      expect(error.isOperational).toBe(true);
    });

    it("should be an instance of Error", () => {
      const error = new AppError(500, "INTERNAL", "Error");
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
    });
  });

  describe("NotFoundError", () => {
    it("should create a 404 error with resource name", () => {
      const error = new NotFoundError("Product");
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe("NOT_FOUND");
      expect(error.message).toBe("Product not found");
    });

    it("should include resource ID in message", () => {
      const error = new NotFoundError("Product", "prod-123");
      expect(error.message).toContain("prod-123");
    });
  });

  describe("ValidationError", () => {
    it("should create a 400 error with field errors", () => {
      const fieldErrors = { name: ["Required"], email: ["Invalid"] };
      const error = new ValidationError(fieldErrors);
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.fieldErrors).toEqual(fieldErrors);
    });

    it("should create a 400 error with string message", () => {
      const error = new ValidationError("Something is wrong");
      expect(error.statusCode).toBe(400);
      expect(error.fieldErrors).toBe("Something is wrong");
    });
  });

  describe("UnauthorizedError", () => {
    it("should create a 401 error with default message", () => {
      const error = new UnauthorizedError();
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe("UNAUTHORIZED");
      expect(error.message).toBe("Authentication required");
    });

    it("should accept custom message", () => {
      const error = new UnauthorizedError("Invalid token");
      expect(error.message).toBe("Invalid token");
    });
  });

  describe("ForbiddenError", () => {
    it("should create a 403 error", () => {
      const error = new ForbiddenError();
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe("FORBIDDEN");
    });
  });

  describe("ConflictError", () => {
    it("should create a 409 error", () => {
      const error = new ConflictError("Email already exists");
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe("CONFLICT");
    });
  });

  describe("RateLimitError", () => {
    it("should create a 429 error", () => {
      const error = new RateLimitError();
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe("RATE_LIMITED");
    });
  });

  describe("successResponse", () => {
    it("should create a success response", () => {
      const response = successResponse({ id: 1, name: "Test" });
      expect(response.success).toBe(true);
      expect(response.data).toEqual({ id: 1, name: "Test" });
      expect(response.error).toBeUndefined();
    });

    it("should include meta when provided", () => {
      const meta = { page: 1, limit: 20, total: 100, totalPages: 5 };
      const response = successResponse([], meta);
      expect(response.meta).toEqual(meta);
    });
  });

  describe("errorResponse", () => {
    it("should create an error response", () => {
      const error = new NotFoundError("Product");
      const response = errorResponse(error);
      expect(response.success).toBe(false);
      expect(response.error?.code).toBe("NOT_FOUND");
      expect(response.error?.message).toBe("Product not found");
    });

    it("should include field errors for ValidationError", () => {
      const fieldErrors = { email: ["Required"] };
      const error = new ValidationError(fieldErrors);
      const response = errorResponse(error);
      expect(response.error?.details).toEqual(fieldErrors);
    });
  });

  describe("buildMeta", () => {
    it("should build pagination meta", () => {
      const params = { page: 2, limit: 20, skip: 20 };
      const meta = buildMeta(params, 95);
      expect(meta).toEqual({
        page: 2,
        limit: 20,
        total: 95,
        totalPages: 5,
      });
    });

    it("should handle zero total", () => {
      const params = { page: 1, limit: 20, skip: 0 };
      const meta = buildMeta(params, 0);
      expect(meta?.totalPages).toBe(0);
    });
  });
});
