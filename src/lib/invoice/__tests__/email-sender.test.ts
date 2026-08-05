import nodemailer from "nodemailer";
import {
  isEmailConfigured,
  sendInvoiceEmail,
  buildInvoiceEmailHtml,
  INVOICE_EMAIL_ENV_VARS,
} from "../email-sender";
import type { InvoiceData } from "../types";

jest.mock("nodemailer", () => ({
  createTransport: jest.fn(),
}));

const createTransportMock = nodemailer.createTransport as jest.Mock;
const sendMailMock = jest.fn();

const ORIGINAL_ENV = { ...process.env };

function setEnv(partial: Record<string, string>): void {
  for (const [key, value] of Object.entries(partial)) process.env[key] = value;
}

function clearEmailEnv(): void {
  for (const name of INVOICE_EMAIL_ENV_VARS) delete process.env[name];
  delete process.env.BREVO_FROM_NAME;
}

const FULL_ENV: Record<string, string> = {
  BREVO_SMTP_HOST: "smtp-relay.brevo.com",
  BREVO_SMTP_PORT: "587",
  BREVO_SMTP_USER: "smtp-login",
  BREVO_SMTP_PASS: "smtp-key",
  BREVO_FROM_EMAIL: "no-reply@leizstore.com",
  BREVO_FROM_NAME: "LEIZ STORE",
};

beforeEach(() => {
  jest.clearAllMocks();
  sendMailMock.mockReset();
  sendMailMock.mockResolvedValue({ messageId: "test-message-id" });
  createTransportMock.mockReturnValue({ sendMail: sendMailMock });
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("isEmailConfigured", () => {
  it("returns false when SMTP variables are missing", () => {
    clearEmailEnv();
    expect(isEmailConfigured()).toBe(false);
  });

  it("returns false when only some variables are present", () => {
    clearEmailEnv();
    setEnv({ BREVO_SMTP_HOST: "smtp-relay.brevo.com", BREVO_FROM_EMAIL: "a@b.com" });
    expect(isEmailConfigured()).toBe(false);
  });

  it("returns true when all required variables are present", () => {
    clearEmailEnv();
    setEnv(FULL_ENV);
    expect(isEmailConfigured()).toBe(true);
  });
});

describe("sendInvoiceEmail", () => {
  it("sends the invoice with the PDF attachment through the SMTP transporter", async () => {
    clearEmailEnv();
    setEnv(FULL_ENV);
    const pdf = Buffer.from("%PDF-1.4 fake-invoice");

    await sendInvoiceEmail({
      to: "buyer@example.com",
      subject: "Invoice INV/2026/08/ABC12",
      html: "<p>Hello</p>",
      pdfFilename: "invoice-INV-2026-08-ABC12.pdf",
      pdfBuffer: pdf,
    });

    expect(createTransportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "smtp-relay.brevo.com",
        port: 587,
        secure: false,
        auth: { user: "smtp-login", pass: "smtp-key" },
      })
    );

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const mail = sendMailMock.mock.calls[0][0];
    expect(mail.from).toBe('"LEIZ STORE" <no-reply@leizstore.com>');
    expect(mail.to).toBe("buyer@example.com");
    expect(mail.subject).toBe("Invoice INV/2026/08/ABC12");
    expect(mail.html).toBe("<p>Hello</p>");
    expect(mail.attachments).toEqual([
      {
        filename: "invoice-INV-2026-08-ABC12.pdf",
        content: pdf,
        contentType: "application/pdf",
      },
    ]);
  });

  it("throws when the SMTP server rejects the message", async () => {
    clearEmailEnv();
    setEnv(FULL_ENV);
    sendMailMock.mockRejectedValue(new Error("535 Authentication failed"));

    await expect(
      sendInvoiceEmail({
        to: "buyer@example.com",
        subject: "Invoice x",
        html: "y",
        pdfFilename: "invoice-x.pdf",
        pdfBuffer: Buffer.from("pdf"),
      })
    ).rejects.toThrow("535 Authentication failed");
  });
});

describe("buildInvoiceEmailHtml", () => {
  const base: InvoiceData = {
    invoiceNo: "INV/2026/08/ABC12",
    orderNumber: "LZ-20260805-ABC123",
    customerName: "Budi",
    items: [
      { name: "Game Voucher", quantity: 2, price: 50000, total: 100000 },
    ],
    subtotal: 100000,
    tax: 11000,
    discount: 0,
    total: 111000,
    currency: "IDR",
    paymentMethod: "bank_transfer",
    createdAt: "2026-08-05T07:00:00.000Z",
  };

  it("includes order details, item rows, and the total", () => {
    const html = buildInvoiceEmailHtml(base);
    expect(html).toContain("INV/2026/08/ABC12");
    expect(html).toContain("LZ-20260805-ABC123");
    expect(html).toContain("Game Voucher");
    // Total (111.000 IDR) formatted in id-ID locale.
    expect(html).toContain("111.000");
  });

  it("escapes buyer-supplied input to prevent HTML injection", () => {
    const html = buildInvoiceEmailHtml({
      ...base,
      customerName: "Budi <script>alert(1)</script>",
      items: [
        { name: 'Item & "Co"', quantity: 1, price: 1000, total: 1000 },
      ],
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Item &amp; &quot;Co&quot;");
  });
});
