import PDFDocument from "pdfkit";
import type { InvoiceData } from "./types";

function formatCurrency(amount: number, currency: string): string {
  if (currency === "USD") {
    return `$${amount.toFixed(2)}`;
  }
  return `Rp${amount.toLocaleString("id-ID")}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("id-ID", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export async function generateInvoicePdf(data: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      info: {
        Title: `Invoice ${data.invoiceNo}`,
        Author: "LEIZ STORE",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - 100;
    const leftCol = 50;
    const rightCol = pageWidth - 200;

    doc.font("Helvetica-Bold").fontSize(24).text("INVOICE", leftCol, 50);

    doc.fontSize(8).fillColor("#999999")
      .text("LEIZ STORE", leftCol, 85)
      .text("Invoice #: " + data.invoiceNo, rightCol, 85);

    doc.fontSize(8).fillColor("#333333")
      .text(data.storeName || "LEIZ STORE", leftCol, 100)
      .text("Date: " + formatDate(data.createdAt), rightCol, 100)
      .text(data.storeAddress || "", leftCol, 113)
      .text("Order: " + data.orderNumber, rightCol, 113);

    if (data.paidAt) {
      doc.text("Paid: " + formatDate(data.paidAt), rightCol, 126);
    }

    doc.moveTo(leftCol, 150).lineTo(leftCol + pageWidth, 150).strokeColor("#cccccc").stroke();

    doc.font("Helvetica-Bold").fontSize(10).fillColor("#333333")
      .text("Bill To:", leftCol, 165);

    doc.font("Helvetica").fontSize(9).fillColor("#555555")
      .text(data.customerName, leftCol, 180)
      .text("Discord: " + (data.customerDiscord || "-"), leftCol, 194)
      .text("IGN: " + (data.customerIGN || "-"), leftCol, 208);

    const tableTop = 250;
    const colX = {
      no: leftCol,
      item: leftCol + 30,
      qty: leftCol + 300,
      price: leftCol + 350,
      total: leftCol + 420,
    };

    doc.moveTo(leftCol, tableTop - 5).lineTo(leftCol + pageWidth, tableTop - 5).strokeColor("#cccccc").stroke();

    doc.font("Helvetica-Bold").fontSize(9).fillColor("#333333")
      .text("#", colX.no, tableTop)
      .text("Item", colX.item, tableTop)
      .text("Qty", colX.qty, tableTop)
      .text("Price", colX.price, tableTop)
      .text("Total", colX.total, tableTop);

    doc.moveTo(leftCol, tableTop + 15).lineTo(leftCol + pageWidth, tableTop + 15).strokeColor("#cccccc").stroke();

    let y = tableTop + 25;
    data.items.forEach((item, i) => {
      doc.font("Helvetica").fontSize(9).fillColor("#555555")
        .text(String(i + 1), colX.no, y)
        .text(item.name, colX.item, y, { width: 250 })
        .text(String(item.quantity), colX.qty, y)
        .text(formatCurrency(item.price, data.currency), colX.price, y)
        .text(formatCurrency(item.total, data.currency), colX.total, y);
      y += 18;
    });

    const lineY = Math.max(y + 5, tableTop + 200);
    doc.moveTo(leftCol, lineY).lineTo(leftCol + pageWidth, lineY).strokeColor("#cccccc").stroke();

    const summaryX = leftCol + 300;
    let sumY = lineY + 10;

    doc.font("Helvetica").fontSize(9).fillColor("#555555")
      .text("Subtotal:", summaryX, sumY)
      .text(formatCurrency(data.subtotal, data.currency), summaryX + 120, sumY, { align: "right", width: 80 });

    if (data.discount > 0) {
      sumY += 14;
      doc.text("Discount:", summaryX, sumY)
        .text("-" + formatCurrency(data.discount, data.currency), summaryX + 120, sumY, { align: "right", width: 80 });
    }

    if (data.tax > 0) {
      sumY += 14;
      doc.text("Tax:", summaryX, sumY)
        .text(formatCurrency(data.tax, data.currency), summaryX + 120, sumY, { align: "right", width: 80 });
    }

    sumY += 14;
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#333333")
      .text("Total:", summaryX, sumY)
      .text(formatCurrency(data.total, data.currency), summaryX + 120, sumY, { align: "right", width: 80 });

    sumY += 30;
    doc.font("Helvetica").fontSize(9).fillColor("#555555")
      .text("Payment Method: " + (data.paymentMethod || "-"), leftCol, sumY);

    sumY += 16;
    if (data.paymentRef) {
      doc.text("Payment Ref: " + data.paymentRef, leftCol, sumY);
      sumY += 16;
    }

    const footerY = doc.page.height - 60;
    doc.moveTo(leftCol, footerY).lineTo(leftCol + pageWidth, footerY).strokeColor("#eeeeee").stroke();
    doc.fontSize(7).fillColor("#999999")
      .text("Thank you for your purchase!", leftCol, footerY + 10)
      .text("LEIZ STORE", leftCol + pageWidth - 80, footerY + 10, { align: "right", width: 80 });

    doc.end();
  });
}
