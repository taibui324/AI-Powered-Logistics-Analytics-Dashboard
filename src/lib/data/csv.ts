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

function numberCell(row: Record<string, string>, key: string, lineNumber: number) {
  const raw = row[key]?.trim();
  if (!raw || !/^-?\d+(\.\d+)?$/.test(raw)) {
    throw new Error(`Invalid numeric value for ${key} on CSV line ${lineNumber}`);
  }
  return Number(raw);
}

export function parseLogisticsCsv(csv: string): LogisticsOrder[] {
  const [headerLine, ...lines] = csv.trim().split(/\r?\n/);
  const headers = splitCsvLine(headerLine);
  if (headers.join(",") !== HEADERS.join(",")) {
    throw new Error("Unexpected logistics CSV header");
  }

  return lines.filter(Boolean).map((line, index) => {
    const lineNumber = index + 2;
    const cells = splitCsvLine(line);
    if (cells.length === headers.length + 1 && cells[cells.length - 1] === "") {
      cells.pop();
    }
    if (cells.length !== headers.length) {
      throw new Error(`Unexpected logistics CSV column count on line ${lineNumber}`);
    }
    const row = Object.fromEntries(headers.map((key, cellIndex) => [key, cells[cellIndex] ?? ""]));
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
      quantity: numberCell(row, "quantity", lineNumber),
      unitPriceUsd: numberCell(row, "unit_price_usd", lineNumber),
      orderValueUsd: numberCell(row, "order_value_usd", lineNumber),
      isPromo: row.is_promo === "1",
      promoDiscountPct: numberCell(row, "promo_discount_pct", lineNumber),
      region: row.region,
      warehouse: row.warehouse
    };
  });
}
