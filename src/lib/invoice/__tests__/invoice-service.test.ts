// eslint-disable-next-line no-var -- var required for jest.mock hoisting
var mockSupabaseQuery: any;
// eslint-disable-next-line no-var -- var required for jest.mock hoisting
var mockSupabaseAdmin: any;
// eslint-disable-next-line no-var -- var required for jest.mock hoisting
var mockStorage: any;
// eslint-disable-next-line no-var -- var required for jest.mock hoisting
var mockResolve: any = { data: null, error: null };

mockSupabaseQuery = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  range: jest.fn().mockReturnThis(),
  upload: jest.fn().mockReturnThis(),
  getPublicUrl: jest.fn().mockReturnThis(),
  then: jest.fn(function (this: any, resolve: any) {
    resolve(mockResolve);
  }),
};

mockStorage = {
  from: jest.fn().mockReturnValue(mockSupabaseQuery),
};

mockSupabaseAdmin = {
  from: jest.fn().mockReturnValue(mockSupabaseQuery),
  storage: mockStorage,
};

jest.mock("@/lib/supabase", () => ({
  supabaseAdmin: mockSupabaseAdmin,
}));

jest.mock("../pdf-generator", () => ({
  generateInvoicePdf: jest.fn().mockResolvedValue(Buffer.from("fake-pdf")),
}));

import { generateAndSendInvoice, getInvoiceByOrder } from "../invoice-service";

describe("invoice-service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolve = { data: null, error: null };
    mockSupabaseQuery.select.mockReturnThis();
    mockSupabaseQuery.eq.mockReturnThis();
    mockSupabaseQuery.single.mockReturnThis();
    mockSupabaseQuery.maybeSingle.mockReturnThis();
    mockSupabaseQuery.insert.mockReturnThis();
    mockSupabaseQuery.update.mockReturnThis();
    mockSupabaseQuery.order.mockReturnThis();
    mockSupabaseQuery.range.mockReturnThis();
    mockSupabaseQuery.then.mockImplementation(function (this: any, resolve: any) {
      resolve(mockResolve);
    });
  });

  it("returns error if order not found", async () => {
    mockResolve = { data: null, error: { message: "not found" } };

    const result = await generateAndSendInvoice("order-1");
    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("returns existing invoice info if already created", async () => {
    mockResolve = {
      data: { id: "inv-1", status: "SENT", invoice_no: "INV/2026/01/ABCDE" },
      error: null,
    };

    const result = await generateAndSendInvoice("order-1");
    expect(result.success).toBe(true);
    expect(result.invoiceNo).toBe("INV/2026/01/ABCDE");
  });

  it("handles existing invoice with FAILED status", async () => {
    mockResolve = {
      data: { id: "inv-1", status: "FAILED", invoice_no: "INV/2026/01/ABCDE" },
      error: null,
    };

    const result = await generateAndSendInvoice("order-1");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Previous attempt failed");
  });

  it("getInvoiceByOrder returns null when not found", async () => {
    mockResolve = { data: null, error: { message: "not found" } };

    const result = await getInvoiceByOrder("order-1");
    expect(result).toBeNull();
  });
});
