// eslint-disable-next-line no-var -- var required for jest.mock hoisting
var mockSupabaseQuery: any;
// eslint-disable-next-line no-var -- var required for jest.mock hoisting
var mockSupabaseAdmin: any;
// eslint-disable-next-line no-var -- var required for jest.mock hoisting
var mockResolve: any = { data: null, error: null };

mockSupabaseQuery = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  lt: jest.fn().mockReturnThis(),
  then: jest.fn(function (this: any, resolve: any) {
    resolve(mockResolve);
  }),
};

mockSupabaseAdmin = {
  from: jest.fn().mockReturnValue(mockSupabaseQuery),
};

jest.mock("@/lib/supabase", () => ({
  supabaseAdmin: mockSupabaseAdmin,
}));

import {
  enqueue,
  complete,
  fail,
  retryFailed,
  getQueueStats,
} from "../queue-service";

describe("queue-service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolve = { data: null, error: null };
    mockSupabaseQuery.select.mockReturnThis();
    mockSupabaseQuery.eq.mockReturnThis();
    mockSupabaseQuery.single.mockReturnThis();
    mockSupabaseQuery.insert.mockReturnThis();
    mockSupabaseQuery.update.mockReturnThis();
    mockSupabaseQuery.order.mockReturnThis();
    mockSupabaseQuery.limit.mockReturnThis();
    mockSupabaseQuery.in.mockReturnThis();
    mockSupabaseQuery.lte.mockReturnThis();
    mockSupabaseQuery.lt.mockReturnThis();
    mockSupabaseQuery.then.mockImplementation(function (this: any, resolve: any) {
      resolve(mockResolve);
    });
  });

  describe("enqueue", () => {
    it("enqueues a job successfully", async () => {
      mockResolve = {
        data: { id: "job-1", type: "SEND_INVOICE_EMAIL", status: "PENDING" },
        error: null,
      };

      const job = await enqueue("SEND_INVOICE_EMAIL" as any, { orderId: "ord-1" });
      expect(job).not.toBeNull();
      expect(job!.id).toBe("job-1");
      expect(mockSupabaseAdmin.from).toHaveBeenCalledWith("job_queue");
    });

    it("returns null on error", async () => {
      mockResolve = { data: null, error: { message: "DB error" } };

      const job = await enqueue("SEND_INVOICE_EMAIL" as any, { orderId: "ord-1" });
      expect(job).toBeNull();
    });
  });

  describe("complete", () => {
    it("marks job as completed", async () => {
      mockResolve = { data: null, error: null };

      await expect(complete("job-1")).resolves.toBeUndefined();
      expect(mockSupabaseAdmin.from).toHaveBeenCalledWith("job_queue");
    });
  });

  describe("fail", () => {
    it("marks job as failed with retry when retry count < max", async () => {
      mockResolve = { data: { retry_count: 0, max_retries: 3 }, error: null };

      await fail("job-1", "error occurred", true);
      expect(mockSupabaseAdmin.from).toHaveBeenCalledWith("job_queue");
    });

    it("marks job as permanently failed when max retries reached", async () => {
      mockResolve = { data: { retry_count: 3, max_retries: 3 }, error: null };

      await fail("job-1", "final error", true);
      expect(mockSupabaseAdmin.from).toHaveBeenCalledWith("job_queue");
    });
  });

  describe("retryFailed", () => {
    it("resets failed jobs for retry", async () => {
      mockResolve = { data: [{ id: "job-1" }, { id: "job-2" }], error: null };

      const count = await retryFailed();
      expect(count).toBe(2);
    });
  });

  describe("getQueueStats", () => {
    it("returns queue statistics", async () => {
      mockResolve = {
        data: [
          { status: "PENDING", count: 5 },
          { status: "COMPLETED", count: 10 },
        ],
        error: null,
      };

      const stats = await getQueueStats();
      expect(stats).toHaveProperty("pending");
      expect(stats).toHaveProperty("processing");
      expect(stats).toHaveProperty("completed");
      expect(stats).toHaveProperty("failed");
    });
  });
});
