/**
 * QRIS Payment Verification Module
 * Handles QR Code Standard Indonesian (QRIS) payment processing
 */

interface QRISConfig {
  merchantId: string;
  apiKey: string;
  callbackUrl?: string;
}

interface QRISPayment {
  id: string;
  qrCode: string;
  amount: number;
  currency: string;
  status: "PENDING" | "PAID" | "EXPIRED" | "FAILED";
  createdAt: Date;
  expiresAt: Date;
}

interface QRISVerification {
  transactionId: string;
  status: "PENDING" | "SUCCESS" | "FAILED";
  amount: number;
  paidAt?: Date;
  paymentMethod?: string;
  reference?: string;
}

function getConfig(): QRISConfig {
  return {
    merchantId: process.env.QRIS_MERCHANT_ID || "",
    apiKey: process.env.QRIS_API_KEY || "",
    callbackUrl: process.env.QRIS_CALLBACK_URL,
  };
}

function isConfigured(): boolean {
  const config = getConfig();
  return !!(config.merchantId && config.apiKey);
}

/**
 * Generate a QRIS payment request
 */
export async function generateQRISPayment(params: {
  amount: number;
  orderNumber: string;
  description?: string;
}): Promise<QRISPayment> {
  if (!isConfigured()) {
    throw new Error("QRIS not configured");
  }

  const config = getConfig();
  const paymentId = `QRIS-${params.orderNumber}-${Date.now()}`;

  try {
    // In production, this would call the QRIS API
    // Example integration with various QRIS providers (Xendit, Midtrans, DOKU, etc.)
    const response = await fetch(
      `${process.env.QRIS_API_URL || "https://api.xendit.co"}/qr_codes`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(`${config.apiKey}:`).toString("base64")}`,
        },
        body: JSON.stringify({
          external_id: params.orderNumber,
          type: "DYNAMIC",
          amount: params.amount,
          currency: "IDR",
          merchant_name: process.env.STORE_NAME || "LEIZ STORE",
          callback_url: config.callbackUrl,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`QRIS API error: ${response.status}`);
    }

    const data = await response.json();

    return {
      id: data.id || paymentId,
      qrCode: data.qr_code || data.url || "",
      amount: params.amount,
      currency: "IDR",
      status: "PENDING",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
    };
  } catch (error) {
    // Fallback: generate a mock QR data string for manual payment
    console.error("QRIS API error, falling back to mock:", error);

    const qrData = generateMockQRISData({
      merchantId: config.merchantId,
      amount: params.amount,
      orderNumber: params.orderNumber,
    });

    return {
      id: paymentId,
      qrCode: qrData,
      amount: params.amount,
      currency: "IDR",
      status: "PENDING",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    };
  }
}

/**
 * Generate mock QRIS data string (EMVCo QR Code Standard)
 */
function generateMockQRISData(params: {
  merchantId: string;
  amount: number;
  orderNumber: string;
}): string {
  // EMVCo QRIS payload format
  // This is a simplified representation of the QRIS standard
  const payload = [
    "000201", // Payload Format Indicator
    "010212", // Static QR
    `29${params.merchantId.length.toString().padStart(2, "0")}${params.merchantId}`, // Merchant Account Info
    "5303360", // Transaction Currency (360 = IDR)
    `54${params.amount.toFixed(2).length.toString().padStart(2, "0")}${params.amount.toFixed(2)}`, // Transaction Amount
    "5802ID", // Country Code
    `62${params.orderNumber.length.toString().padStart(2, "0")}${params.orderNumber}`, // Additional Data
    "6304", // CRC placeholder
  ].join("");

  // Simple CRC-16 CCITT calculation
  const crc = calculateCRC16(payload);
  return payload + crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * Calculate CRC-16 CCITT checksum
 */
function calculateCRC16(data: string): number {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }
      crc &= 0xffff;
    }
  }
  return crc;
}

/**
 * Verify QRIS payment status
 */
export async function verifyQRISPayment(
  transactionId: string
): Promise<QRISVerification> {
  if (!isConfigured()) {
    throw new Error("QRIS not configured");
  }

  const config = getConfig();

  try {
    const response = await fetch(
      `${process.env.QRIS_API_URL || "https://api.xendit.co"}/qr_codes/${transactionId}/payments`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${config.apiKey}:`).toString("base64")}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`QRIS verification failed: ${response.status}`);
    }

    const data = await response.json();
    const payment = data.data?.[0];

    if (!payment) {
      return {
        transactionId,
        status: "PENDING",
        amount: 0,
      };
    }

    return {
      transactionId,
      status: payment.status === "SUCCEEDED" ? "SUCCESS" : "FAILED",
      amount: payment.amount,
      paidAt: payment.created ? new Date(payment.created) : undefined,
      paymentMethod: payment.payment_method_type,
      reference: payment.id,
    };
  } catch (error) {
    console.error("QRIS verification error:", error);
    return {
      transactionId,
      status: "PENDING",
      amount: 0,
    };
  }
}

/**
 * Handle QRIS payment callback/webhook
 */
export async function handleQRISCallback(body: Record<string, unknown>): Promise<{
  orderNumber: string;
  status: "SUCCESS" | "FAILED";
  amount: number;
}> {
  const externalId = body.external_id as string;
  const status = body.status as string;
  const amount = body.amount as number;

  return {
    orderNumber: externalId,
    status: status === "SUCCEEDED" ? "SUCCESS" : "FAILED",
    amount,
  };
}

export const qrisService = {
  isConfigured,
  generateQRISPayment,
  verifyQRISPayment,
  handleQRISCallback,
};