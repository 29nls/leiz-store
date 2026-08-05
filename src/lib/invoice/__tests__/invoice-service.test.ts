// eslint-disable-next-line no-var -- var required for jest.mock hoisting
var mockSupabaseAdmin: any;
// eslint-disable-next-line no-var -- var required for jest.mock hoisting
var mockStorage: any;
// eslint-disable-next-line no-var -- var required for jest.mock hoisting
var results: Record<string, any> = {};
// eslint-disable-next-line no-var -- var required for jest.mock hoisting
var updatePayloads: any[] = [];

function makeQuery(table: string): any {
  const ops: string[] = [];
  const q: any = {
    select: jest.fn(() => { ops.push("select"); return q; }),
    eq: jest.fn(() => { ops.push("eq"); return q; }),
    single: jest.fn(() => { ops.push("single"); return q; }),
    maybeSingle: jest.fn(() => { ops.push("maybeSingle"); return q; }),
    insert: jest.fn(() => { ops.push("insert"); return q; }),
    update: jest.fn((data: any) => { ops.push("update"); updatePayloads.push(data); return q; }),
    order: jest.fn(() => { ops.push("order"); return q; }),
    range: jest.fn(() => { ops.push("range"); return q; }),
    limit: jest.fn(() => { ops.push("limit"); return q; }),
    upload: jest.fn(() => { ops.push("upload"); return q; }),
    createSignedUrl: jest.fn(() => { ops.push("createSignedUrl"); return q; }),
    then: jest.fn((resolve: any) => {
      resolve(pickResult(table, ops));
    }),
  };
  return q;
}

function pickResult(table: string, ops: string[]): any {
  if (table === "order" && ops.includes("single")) return results.order;
  if (ops.includes("maybeSingle")) return results.invoiceLookup;
  if (ops.includes("insert")) return results.insert;
  if (ops.includes("update")) return results.update;
  if (table === "invoice" && ops.includes("single")) return results.invoiceById;
  if (ops.includes("upload")) return results.upload;
  if (ops.includes("createSignedUrl")) return results.signedUrl;
  return results.default;
}

mockStorage = {
  from: jest.fn(() => makeQuery("storage")),
};

mockSupabaseAdmin = {
  from: jest.fn((table: string) => makeQuery(String(table))),
  storage: mockStorage,
  rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
};

jest.mock("@/lib/supabase", () => ({
  supabaseAdmin: mockSupabaseAdmin,
}));

jest.mock("../pdf-generator", () => ({
  generateInvoicePdf: jest.fn().mockResolvedValue(Buffer.from("fake-pdf")),
}));

jest.mock("../email-sender", () => ({
  sendInvoiceEmail: jest.fn(),
  isEmailConfigured: jest.fn(),
  buildInvoiceEmailHtml: jest.fn(() => "<html>invoice</html>"),
}));

jest.mock("@/lib/queue", () => ({
  enqueue: jest.fn(),
  processAll: jest.fn(),
}));

import { generateAndSendInvoice, getInvoiceByOrder, resendInvoice, processPendingJobs } from "../invoice-service";
import { sendInvoiceEmail, isEmailConfigured } from "../email-sender";
import { processAll } from "@/lib/queue";

const sendInvoiceEmailMock = sendInvoiceEmail as jest.Mock;
const isEmailConfiguredMock = isEmailConfigured as jest.Mock;
const processAllMock = processAll as jest.Mock;

function setDefaultResults(): void {
  results = {
    invoiceLookup: { data: null, error: null },
    invoiceById: { data: null, error: null },
    insert: { data: [{ id: "inv-1" }], error: null },
    update: { data: [{}], error: null },
    order: {
      data: {
        id: "order-1",
        order_number: "LZ-20260805-ABC123",
        customer_name: "Budi",
        customer_email: "budi@example.com",
        subtotal: 100000,
        tax: 11000,
        total: 111000,
        currency: "IDR",
        order_item: [
          { name: "Game Voucher", quantity: 1, price: 100000, total: 100000 },
        ],
      },
      error: null,
    },
    upload: { data: { path: "invoices/invoice-INV-2026-08-ABC12.pdf" }, error: null },
    signedUrl: { data: { signedUrl: "https://signed.example.com/invoice.pdf" }, error: null },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  updatePayloads = [];
  setDefaultResults();
  isEmailConfiguredMock.mockReturnValue(true);
  sendInvoiceEmailMock.mockResolvedValue(undefined);
});

describe("invoice-service", () => {
  it("returns error if order not found", async () => {
    results.order = { data: null, error: { message: "not found" } };

    const result = await generateAndSendInvoice("order-1");
    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
    expect(sendInvoiceEmailMock).not.toHaveBeenCalled();
  });

  it("short-circuits when the invoice is fully delivered (PDF + email SENT)", async () => {
    results.invoiceLookup = {
      data: { id: "inv-1", status: "SENT", email_status: "SENT", invoice_no: "INV/2026/08/ABC12" },
      error: null,
    };

    const result = await generateAndSendInvoice("order-1");
    expect(result.success).toBe(true);
    expect(result.invoiceNo).toBe("INV/2026/08/ABC12");
    // The idempotency guard must prevent any re-send.
    expect(sendInvoiceEmailMock).not.toHaveBeenCalled();
    expect(updatePayloads).toHaveLength(0);
  });

  it("retries a previously FAILED invoice instead of blocking", async () => {
    results.invoiceLookup = {
      data: { id: "inv-1", status: "FAILED", email_status: "FAILED", invoice_no: "INV/2026/08/ABC12" },
      error: null,
    };

    const result = await generateAndSendInvoice("order-1");
    expect(result.success).toBe(true);
    expect(result.emailStatus).toBe("SENT");
    expect(sendInvoiceEmailMock).toHaveBeenCalledTimes(1);

    // The failed invoice is reset to PENDING before reprocessing (no re-insert).
    const reset = updatePayloads.find((p) => p.status === "PENDING");
    expect(reset).toBeTruthy();
    expect(reset.email_status).toBe("PENDING");
    expect(updatePayloads.some((p) => p.email_status === "SENT" && p.sent_via_email === true)).toBe(true);
  });

  it("sends the invoice email and marks email_status SENT", async () => {
    const result = await generateAndSendInvoice("order-1");
    expect(result.success).toBe(true);
    expect(result.emailStatus).toBe("SENT");
    expect(sendInvoiceEmailMock).toHaveBeenCalledTimes(1);
    expect(sendInvoiceEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "budi@example.com",
        pdfFilename: expect.stringContaining("invoice-"),
      })
    );
    const emailUpdate = updatePayloads.find((p) => p.email_status === "SENT");
    expect(emailUpdate).toBeTruthy();
    expect(emailUpdate.sent_via_email).toBe(true);
  });

  it("does not mark the invoice delivered when the email send fails", async () => {
    sendInvoiceEmailMock.mockRejectedValue(new Error("535 Authentication failed"));

    const result = await generateAndSendInvoice("order-1");
    expect(result.success).toBe(false);
    expect(result.emailStatus).toBe("FAILED");
    expect(result.error).toContain("535 Authentication failed");

    const failedUpdate = updatePayloads.find((p) => p.email_status === "FAILED");
    expect(failedUpdate).toBeTruthy();
    expect(JSON.parse(failedUpdate.error_log)[0]).toContain("535 Authentication failed");
    // Never claim the email was delivered.
    expect(updatePayloads.some((p) => p.email_status === "SENT" && p.sent_via_email === true)).toBe(false);
  });

  it("marks SKIPPED when SMTP is not configured (never silent success)", async () => {
    isEmailConfiguredMock.mockReturnValue(false);

    const result = await generateAndSendInvoice("order-1");
    expect(result.success).toBe(false);
    expect(result.emailStatus).toBe("SKIPPED");
    expect(sendInvoiceEmailMock).not.toHaveBeenCalled();
    const skipped = updatePayloads.find((p) => p.email_status === "SKIPPED");
    expect(skipped).toBeTruthy();
  });

  it("marks SKIPPED when the order has no buyer email", async () => {
    results.order.data.customer_email = null;

    const result = await generateAndSendInvoice("order-1");
    expect(result.success).toBe(false);
    expect(result.emailStatus).toBe("SKIPPED");
    expect(sendInvoiceEmailMock).not.toHaveBeenCalled();
  });

  it("marks SKIPPED when the stored order email is malformed (never reaches SMTP)", async () => {
    // Simulates a legacy/arbitrary customer_email (e.g. with CRLF) that bypassed
    // checkout validation — it must not reach the SMTP envelope.
    results.order.data.customer_email = "not-an-email\r\nBcc: evil@example.com";

    const result = await generateAndSendInvoice("order-1");
    expect(result.success).toBe(false);
    expect(result.emailStatus).toBe("SKIPPED");
    expect(sendInvoiceEmailMock).not.toHaveBeenCalled();
    const skipped = updatePayloads.find((p) => p.email_status === "SKIPPED");
    expect(skipped).toBeTruthy();
    expect(JSON.parse(skipped.error_log)[0]).toBe("Invalid customer email on order");
  });

  it("re-attempts email for a SENT invoice whose email previously FAILED", async () => {
    results.invoiceLookup = {
      data: { id: "inv-1", status: "SENT", email_status: "FAILED", invoice_no: "INV/2026/08/ABC12" },
      error: null,
    };

    const result = await generateAndSendInvoice("order-1");
    expect(result.success).toBe(true);
    expect(result.emailStatus).toBe("SENT");
    expect(sendInvoiceEmailMock).toHaveBeenCalledTimes(1);
  });

  it("getInvoiceByOrder returns null when not found", async () => {
    results.invoiceLookup = { data: null, error: { message: "not found" } };

    const result = await getInvoiceByOrder("order-1");
    expect(result).toBeNull();
  });

  it("resendInvoice re-sends an invoice whose email failed", async () => {
    const failedInvoice = {
      id: "inv-1", order_id: "order-1", invoice_no: "INV/2026/08/ABC12",
      status: "SENT", email_status: "FAILED",
    };
    results.invoiceById = { data: failedInvoice, error: null };
    results.invoiceLookup = { data: failedInvoice, error: null };

    const ok = await resendInvoice("inv-1");
    expect(ok).toBe(true);
    expect(sendInvoiceEmailMock).toHaveBeenCalledTimes(1);
  });

  it("resendInvoice treats SKIPPED as handled", async () => {
    const skippedInvoice = {
      id: "inv-1", order_id: "order-1", invoice_no: "INV/2026/08/ABC12",
      status: "SENT", email_status: "SKIPPED",
    };
    results.invoiceById = { data: skippedInvoice, error: null };
    results.invoiceLookup = { data: skippedInvoice, error: null };
    isEmailConfiguredMock.mockReturnValue(false);

    const ok = await resendInvoice("inv-1");
    expect(ok).toBe(true);
  });

  it("resendInvoice returns false when the invoice does not exist", async () => {
    results.invoiceById = { data: null, error: { message: "not found" } };

    const ok = await resendInvoice("missing");
    expect(ok).toBe(false);
  });

  it("job handler completes SKIPPED jobs but retries FAILED email jobs", async () => {
    let capturedHandler: ((job: any) => Promise<boolean>) | null = null;
    processAllMock.mockImplementation(async (handler: any) => {
      capturedHandler = handler;
      return 1;
    });

    const count = await processPendingJobs(5);
    expect(count).toBe(1);
    expect(capturedHandler).toBeTruthy();

    const job = { type: "GENERATE_INVOICE", payload: { orderId: "order-1" } };

    // SMTP unconfigured → SKIPPED → job completes (avoids retry storms).
    isEmailConfiguredMock.mockReturnValue(false);
    expect(await capturedHandler!(job)).toBe(true);

    // SMTP configured but send fails → FAILED → job must be retried.
    isEmailConfiguredMock.mockReturnValue(true);
    sendInvoiceEmailMock.mockRejectedValue(new Error("connection refused"));
    expect(await capturedHandler!(job)).toBe(false);

    // Unknown job types are a no-op success.
    expect(await capturedHandler!({ type: "OTHER", payload: {} })).toBe(true);
  });
});
