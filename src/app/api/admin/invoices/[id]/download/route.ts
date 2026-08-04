import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { createInvoiceSignedUrl, invoiceStoragePath } from "@/lib/invoice/invoice-storage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { data: invoice, error } = await supabaseAdmin
    .from("invoice")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const url = await createInvoiceSignedUrl(invoice.pdf_path || invoiceStoragePath(invoice.invoice_no));
  if (!url) return NextResponse.json({ error: "Invoice URL unavailable" }, { status: 503 });

  return NextResponse.json({ url });
}
