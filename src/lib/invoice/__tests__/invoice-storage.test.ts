import { invoiceStoragePath, INVOICE_SIGNED_URL_TTL_SECONDS, createInvoiceSignedUrl } from "../invoice-storage";

jest.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    storage: {
      from: jest.fn(() => ({
        createSignedUrl: jest.fn().mockResolvedValue({ data: { signedUrl: "https://signed.test/invoice.pdf" }, error: null }),
      })),
    },
  },
}));

describe("invoice storage", () => {
  it("keeps invoice files in the invoices prefix with a safe filename", () => {
    expect(invoiceStoragePath("INV/20260804/ABC12")).toBe("invoices/invoice-INV-20260804-ABC12.pdf");
  });

  it("uses a bounded signed URL lifetime", () => {
    expect(INVOICE_SIGNED_URL_TTL_SECONDS).toBe(15 * 60);
  });

  it("creates signed URLs from a private storage path", async () => {
    await expect(createInvoiceSignedUrl("invoices/invoice-INV-1.pdf")).resolves.toBe("https://signed.test/invoice.pdf");
  });
});
