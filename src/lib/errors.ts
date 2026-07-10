// ─── Custom Error Classes ───────────────────────────────────

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      404,
      "NOT_FOUND",
      id ? `${resource} with id '${id}' not found` : `${resource} not found`
    );
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(
    public fieldErrors: Record<string, string[]> | string
  ) {
    const message = typeof fieldErrors === "string" ? fieldErrors : "Validation failed";
    super(400, "VALIDATION_ERROR", message);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(401, "UNAUTHORIZED", message);
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Insufficient permissions") {
    super(403, "FORBIDDEN", message);
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, "CONFLICT", message);
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many requests") {
    super(429, "RATE_LIMITED", message);
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

// ─── API Response Types ─────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, string[]> | string;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

// ─── Response Helpers ───────────────────────────────────────

export function successResponse<T>(data: T, meta?: ApiResponse["meta"]): ApiResponse<T> {
  return {
    success: true,
    data,
    ...(meta && { meta }),
  };
}

export function errorResponse(
  error: AppError
): ApiResponse {
  const details = error instanceof ValidationError ? error.fieldErrors : undefined;
  return {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      details,
    },
  };
}

// ─── Pagination Helpers ─────────────────────────────────────

export function buildMeta(
  params: { page: number; limit: number; skip: number },
  total: number
): ApiResponse["meta"] {
  return {
    page: params.page,
    limit: params.limit,
    total,
    totalPages: Math.ceil(total / params.limit),
  };
}
