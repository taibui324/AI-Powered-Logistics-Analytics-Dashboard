import { Pool } from "pg";
import { DashboardFilters, LogisticsOrder } from "@/lib/analytics/types";
import { LogisticsRepository, requireServerEnv } from "./logisticsRepository";

type PostgresLogisticsOrderRow = {
  client_id: string;
  order_id: string;
  order_date: string | Date;
  delivery_date: string | Date | null;
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

function dateField(value: string | Date | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

function numberField(value: number | string, field: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric field from Postgres: ${field}`);
  }
  return parsed;
}

function statusField(value: string): LogisticsOrder["status"] {
  if (!STATUSES.has(value)) {
    throw new Error(`Invalid status from Postgres: ${value}`);
  }
  return value as LogisticsOrder["status"];
}

export function mapPostgresOrder(row: PostgresLogisticsOrderRow): LogisticsOrder {
  const orderDate = dateField(row.order_date);
  if (!orderDate) throw new Error("Invalid order_date from Postgres");
  return {
    clientId: row.client_id,
    orderId: row.order_id,
    orderDate,
    deliveryDate: dateField(row.delivery_date),
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

function sslConfig() {
  return process.env.POSTGRES_SSL === "false" ? false : { rejectUnauthorized: false };
}

function createPool() {
  return new Pool({
    connectionString: requireServerEnv("DATABASE_URL"),
    ssl: sslConfig(),
    max: 3
  });
}

export function createPostgresLogisticsRepository(): LogisticsRepository {
  const pool = createPool();

  return {
    async listOrders(filters: DashboardFilters = {}) {
      const values: string[] = [];
      const where: string[] = [];
      const addFilter = (column: string, value?: string, operator = "=") => {
        if (!value) return;
        values.push(value);
        where.push(`${column} ${operator} $${values.length}`);
      };

      addFilter("order_date", filters.from, ">=");
      addFilter("order_date", filters.to, "<=");
      addFilter("carrier", filters.carrier);
      addFilter("region", filters.region);
      addFilter("warehouse", filters.warehouse);
      addFilter("product_category", filters.productCategory);
      addFilter("sku", filters.sku);

      const sql = `
        select *
        from public.logistics_orders
        ${where.length ? `where ${where.join(" and ")}` : ""}
        order by order_date asc, order_id asc
      `;
      const result = await pool.query<PostgresLogisticsOrderRow>(sql, values);
      return result.rows.map(mapPostgresOrder);
    }
  };
}
