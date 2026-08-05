import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { createInvoiceSignedUrl, invoiceStoragePath } from "@/lib/invoice/invoice-storage";
import { successResponse, errorResponse, AppError, NotFoundError, UnauthorizedError } from "@/lib/errors";
import { enforceAdminRateLimit } from "@/lib/rate-limit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = await enforceAdminRateLimit(request, "invoices");
  if (limited) return limited;

  if (!(await isAdminRequest(request))) {
    return NextResponse.json(errorResponse(new UnauthorizedError()), { status: 401 });
  }

  const { id } = await params;
  const { data: invoice, error } = await supabaseAdmin
    .from("invoice")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !invoice) {
    return NextResponse.json(errorResponse(new NotFoundError("Invoice", id)), { status: 404 });
  }

  const url = await createInvoiceSignedUrl(invoice.pdf_path || invoiceStoragePath(invoice.invoice_no));
  if (!url) {
    return NextResponse.json(
      errorResponse(new AppError(503, "INVOICE_UNAVAILABLE", "Invoice URL unavailable")),
      { status: 503 }
    );
  }

  return NextResponse.json(successResponse({ url }));
}
