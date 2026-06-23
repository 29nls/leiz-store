import "@testing-library/jest-dom";

// Mock next/server to avoid "Request is not defined" in jsdom
jest.mock("next/server", () => {
  const MockNextResponse = {
    json: function (data, init) {
      return new (globalThis as Record<string, unknown>).Response(JSON.stringify(data), {
        status: (init && init.status) || 200,
        headers: { "Content-Type": "application/json", ...(init && init.headers) },
      });
    },
  };
  return { NextResponse: MockNextResponse };
});

// Mock Prisma
jest.mock("@/lib/db", () => {
  const mockFn = jest.fn();
  const mockPrisma = {
    $disconnect: jest.fn(),
    $queryRaw: jest.fn().mockResolvedValue([]),
    $transaction: mockFn,
    product: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      aggregate: jest.fn(),
    },
    order: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      aggregate: jest.fn(),
    },
    orderItem: {
      create: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    activityLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    inventoryLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    setting: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    analyticsEvent: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    stockAlert: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    notification: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    currencyRate: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
    salesForecast: {
      findMany: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
    customerSegment: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      groupBy: jest.fn(),
      count: jest.fn(),
    },
    productRecommendation: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      count: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  // $transaction should call the callback with the prisma mock
  mockFn.mockImplementation((cb) => cb(mockPrisma));

  return { prisma: mockPrisma };
});

// Mock fetch
Object.defineProperty(global, "fetch", {
  value: jest.fn(),
  writable: true,
});

// Mock navigator.clipboard
Object.defineProperty(navigator, "clipboard", {
  value: { writeText: jest.fn() },
  writable: true,
});

// Mock IntersectionObserver
class MockIntersectionObserver {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
}
Object.defineProperty(window, "IntersectionObserver", {
  writable: true,
  value: MockIntersectionObserver,
});

// Mock ResizeObserver
class MockResizeObserver {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
}
Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  value: MockResizeObserver,
});

// Polyfill crypto.randomUUID for jsdom
if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, "crypto", {
    value: {
      ...(globalThis.crypto || {}),
      randomUUID: () =>
        "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
        }),
    },
    writable: true,
  });
}

// Suppress console.error in tests
const originalError = console.error;
beforeAll(() => {
  console.error = function () {
    const args = Array.from(arguments);
    if (
      typeof args[0] === "string" &&
      args[0].includes("Warning: ReactDOM.render is no longer supported")
    ) {
      return;
    }
    originalError.apply(console, args as []);
  };
});

afterAll(() => {
  console.error = originalError;
});
