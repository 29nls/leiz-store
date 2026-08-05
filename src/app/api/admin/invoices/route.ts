import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { listInvoices, resendInvoice, getInvoiceByOrder } from "@/lib/invoice";
import { successResponse, errorResponse, AppError, UnauthorizedError, ValidationError } from "@/lib/errors";
import { enforceAdminRateLimit } from "@/lib/rate-limit";

async function checkAuth(req: NextRequest): Promise<{ authorized: boolean; error?: NextResponse }> {
  if (await isAdminRequest(req)) return { authorized: true };
  return {
    authorized: false,
    error: NextResponse.json(errorResponse(new UnauthorizedError()), { status: 401 }),
  };
}

export async function GET(req: NextRequest) {
  const limited = await enforceAdminRateLimit(req, "invoices");
  if (limited) return limited;

  const auth = await checkAuth(req);
  if (!auth.authorized) return auth.error!;

  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const status = searchParams.get("status") || undefined;
  const orderId = searchParams.get("order_id") || undefined;

  try {
    if (orderId) {
      const invoice = await getInvoiceByOrder(orderId);
      return NextResponse.json(successResponse({ invoice }));
    }

    const result = await listInvoices({ page, limit, status });
    return NextResponse.json(successResponse(result, {
      page: result.page,
      limit,
      total: result.total,
      totalPages: result.totalPages,
    }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      errorResponse(new AppError(500, "INTERNAL_ERROR", msg)),
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const limited = await enforceAdminRateLimit(req, "invoices");
  if (limited) return limited;

  const auth = await checkAuth(req);
  if (!auth.authorized) return auth.error!;

  try {
    const { invoiceId, action } = await req.json();

    if (!invoiceId) {
      return NextResponse.json(
        errorResponse(new ValidationError("invoiceId required")),
        { status: 400 }
      );
    }

    if (action === "resend") {
      const ok = await resendInvoice(invoiceId);
      if (!ok) {
        return NextResponse.json(
          errorResponse(new AppError(404, "NOT_FOUND", "Invoice not found")),
          { status: 404 }
        );
      }
      return NextResponse.json(successResponse({ message: "Invoice resend queued" }));
    }

    return NextResponse.json(
      errorResponse(new ValidationError("Unknown action")),
      { status: 400 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      errorResponse(new AppError(500, "INTERNAL_ERROR", msg)),
      { status: 500 }
    );
  }
}
