import { createClient } from "@supabase/supabase-js";
import { DashboardFilters, LogisticsOrder } from "@/lib/analytics/types";
import { LogisticsRepository, requireServerEnv } from "./logisticsRepository";

type SupabaseLogisticsOrderRow = {
  client_id: string;
  order_id: string;
  order_date: string;
  delivery_date: string | null;
  carrier: string;
  origin_city: string;
  destination_city: string;
  status: string;
  sku: string;
  product_category: string;
  quantity: number | string;
  unit_price_usd: number | string;
  order_value_usd: number | string;
  is_promo: boolean;
  promo_discount_pct: number | string;
  region: string;
  warehouse: string;
};

const STATUSES = new Set(["delivered", "delayed", "in_transit", "exception", "canceled"]);

function numberField(value: number | string, field: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric field from Supabase: ${field}`);
  }
  return parsed;
}

function statusField(value: string): LogisticsOrder["status"] {
  if (!STATUSES.has(value)) {
    throw new Error(`Invalid status from Supabase: ${value}`);
  }
  return value as LogisticsOrder["status"];
}

export function mapSupabaseOrder(row: SupabaseLogisticsOrderRow): LogisticsOrder {
  return {
    clientId: row.client_id,
    orderId: row.order_id,
    orderDate: row.order_date,
    deliveryDate: row.delivery_date,
    carrier: row.carrier,
    originCity: row.origin_city,
    destinationCity: row.destination_city,
    status: statusField(row.status),
    sku: row.sku,
    productCategory: row.product_category,
    quantity: numberField(row.quantity, "quantity"),
    unitPriceUsd: numberField(row.unit_price_usd, "unit_price_usd"),
    orderValueUsd: numberField(row.order_value_usd, "order_value_usd"),
    isPromo: row.is_promo,
    promoDiscountPct: numberField(row.promo_discount_pct, "promo_discount_pct"),
    region: row.region,
    warehouse: row.warehouse
  };
}

function createSupabaseRepositoryClient() {
  return createClient(requireServerEnv("SUPABASE_URL"), requireServerEnv("SUPABASE_ANON_KEY"), {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

export function createSupabaseLogisticsRepository(): LogisticsRepository {
  const supabase = createSupabaseRepositoryClient();

  return {
    async listOrders(filters: DashboardFilters = {}) {
      let query = supabase
        .from("logistics_orders")
        .select("*")
        .order("order_date", { ascending: true })
        .order("order_id", { ascending: true })
        .limit(5000);

      if (filters.from) query = query.gte("order_date", filters.from);
      if (filters.to) query = query.lte("order_date", filters.to);
      if (filters.carrier) query = query.eq("carrier", filters.carrier);
      if (filters.region) query = query.eq("region", filters.region);
      if (filters.warehouse) query = query.eq("warehouse", filters.warehouse);
      if (filters.productCategory) query = query.eq("product_category", filters.productCategory);
      if (filters.sku) query = query.eq("sku", filters.sku);

      const { data, error } = await query;
      if (error) {
        throw new Error(`Unable to read logistics_orders from Supabase: ${error.message}`);
      }
      return (data as SupabaseLogisticsOrderRow[]).map(mapSupabaseOrder);
    }
  };
}
