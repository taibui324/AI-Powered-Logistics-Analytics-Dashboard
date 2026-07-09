import { LogisticsOrder } from "@/lib/analytics/types";

const HEADERS = [
  "client_id",
  "order_id",
  "order_date",
  "delivery_date",
  "carrier",
  "origin_city",
  "destination_city",
  "status",
  "sku",
  "product_category",
  "quantity",
  "unit_price_usd",
  "order_value_usd",
  "is_promo",
  "promo_discount_pct",
  "region",
  "warehouse"
] as const;

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells;
}

export function parseLogisticsCsv(csv: string): LogisticsOrder[] {
  const [headerLine, ...lines] = csv.trim().split(/\r?\n/);
  const headers = splitCsvLine(headerLine);
  if (headers.join(",") !== HEADERS.join(",")) {
    throw new Error("Unexpected logistics CSV header");
  }

  return lines.filter(Boolean).map((line) => {
    const row = Object.fromEntries(headers.map((key, index) => [key, splitCsvLine(line)[index] ?? ""]));
    return {
      clientId: row.client_id,
      orderId: row.order_id,
      orderDate: row.order_date,
      deliveryDate: row.delivery_date || null,
      carrier: row.carrier,
      originCity: row.origin_city,
      destinationCity: row.destination_city,
      status: row.status as LogisticsOrder["status"],
      sku: row.sku,
      productCategory: row.product_category,
      quantity: Number(row.quantity),
      unitPriceUsd: Number(row.unit_price_usd),
      orderValueUsd: Number(row.order_value_usd),
      isPromo: row.is_promo === "1",
      promoDiscountPct: Number(row.promo_discount_pct),
      region: row.region,
      warehouse: row.warehouse
    };
  });
}
