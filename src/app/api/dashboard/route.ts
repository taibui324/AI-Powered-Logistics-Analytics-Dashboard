import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { summarizeDashboard } from "@/lib/analytics/dashboard";
import { loadLogisticsOrders } from "@/lib/data/logistics";

const filtersSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  carrier: z.string().optional(),
  region: z.string().optional(),
  warehouse: z.string().optional(),
  productCategory: z.string().optional()
});

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const parsed = filtersSchema.safeParse({
      from: params.get("from") || undefined,
      to: params.get("to") || undefined,
      carrier: params.get("carrier") || undefined,
      region: params.get("region") || undefined,
      warehouse: params.get("warehouse") || undefined,
      productCategory: params.get("productCategory") || undefined
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid dashboard filters" }, { status: 400 });
    }
    const rows = await loadLogisticsOrders();
    return NextResponse.json(summarizeDashboard(rows, parsed.data));
  } catch {
    return NextResponse.json({ error: "Unable to load dashboard analytics" }, { status: 500 });
  }
}
