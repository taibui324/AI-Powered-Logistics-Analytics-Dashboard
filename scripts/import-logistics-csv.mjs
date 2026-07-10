import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

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
];

function loadEnvFile(path) {
  try {
    const contents = readFileSync(path, "utf8");
    contents.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) return;
      const [key, ...rest] = trimmed.split("=");
      if (!process.env[key]) {
        process.env[key] = rest.join("=").replace(/^['"]|['"]$/g, "");
      }
    });
  } catch {
    // Env files are optional; CI and hosted shells usually provide env vars directly.
  }
}

function splitCsvLine(line) {
  const cells = [];
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

function numberCell(row, key) {
  const raw = row[key]?.trim();
  if (!raw || !/^-?\d+(\.\d+)?$/.test(raw)) {
    throw new Error(`Invalid numeric value for ${key}`);
  }
  return Number(raw);
}

function parseCsv(csv) {
  const [headerLine, ...lines] = csv.trim().split(/\r?\n/);
  const headers = splitCsvLine(headerLine);
  if (headers.join(",") !== HEADERS.join(",")) {
    throw new Error("Unexpected logistics CSV header");
  }

  return lines.filter(Boolean).map((line) => {
    const values = splitCsvLine(line);
    if (values.length === headers.length + 1 && values[values.length - 1] === "") {
      values.pop();
    }
    if (values.length !== headers.length) {
      throw new Error("Unexpected logistics CSV column count");
    }
    const row = Object.fromEntries(headers.map((key, index) => [key, values[index] ?? ""]));
    return {
      client_id: row.client_id,
      order_id: row.order_id,
      order_date: row.order_date,
      delivery_date: row.delivery_date || null,
      carrier: row.carrier,
      origin_city: row.origin_city,
      destination_city: row.destination_city,
      status: row.status,
      sku: row.sku,
      product_category: row.product_category,
      quantity: numberCell(row, "quantity"),
      unit_price_usd: numberCell(row, "unit_price_usd"),
      order_value_usd: numberCell(row, "order_value_usd"),
      is_promo: row.is_promo === "1",
      promo_discount_pct: numberCell(row, "promo_discount_pct"),
      region: row.region,
      warehouse: row.warehouse
    };
  });
}

function postgresConnectionString(databaseUrl) {
  if (process.env.POSTGRES_SSL === "false") return databaseUrl;
  const url = new URL(databaseUrl);
  url.searchParams.delete("sslmode");
  return url.toString();
}

async function main() {
  loadEnvFile(resolve(process.cwd(), ".env.local"));
  loadEnvFile(resolve(process.cwd(), ".env"));

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for Postgres import.");
  }

  const csvPath = resolve(process.cwd(), process.argv[2] ?? "data/logistics.csv");
  const rows = parseCsv(readFileSync(csvPath, "utf8"));
  const pool = new pg.Pool({
    connectionString: postgresConnectionString(databaseUrl),
    ssl: process.env.POSTGRES_SSL === "false" ? false : { rejectUnauthorized: false }
  });

  try {
    await pool.query(readFileSync(resolve(process.cwd(), "db/migrations/001_create_logistics_orders.sql"), "utf8"));
    const insertSql = `
      insert into public.logistics_orders (
        client_id, order_id, order_date, delivery_date, carrier, origin_city, destination_city,
        status, sku, product_category, quantity, unit_price_usd, order_value_usd,
        is_promo, promo_discount_pct, region, warehouse
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      on conflict (order_id) do update set
        client_id = excluded.client_id,
        order_date = excluded.order_date,
        delivery_date = excluded.delivery_date,
        carrier = excluded.carrier,
        origin_city = excluded.origin_city,
        destination_city = excluded.destination_city,
        status = excluded.status,
        sku = excluded.sku,
        product_category = excluded.product_category,
        quantity = excluded.quantity,
        unit_price_usd = excluded.unit_price_usd,
        order_value_usd = excluded.order_value_usd,
        is_promo = excluded.is_promo,
        promo_discount_pct = excluded.promo_discount_pct,
        region = excluded.region,
        warehouse = excluded.warehouse
    `;

    for (const row of rows) {
      await pool.query(insertSql, [
        row.client_id,
        row.order_id,
        row.order_date,
        row.delivery_date,
        row.carrier,
        row.origin_city,
        row.destination_city,
        row.status,
        row.sku,
        row.product_category,
        row.quantity,
        row.unit_price_usd,
        row.order_value_usd,
        row.is_promo,
        row.promo_discount_pct,
        row.region,
        row.warehouse
      ]);
    }
  } finally {
    await pool.end();
  }

  const statusCounts = rows.reduce((counts, row) => {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
    return counts;
  }, {});

  console.log(`Imported ${rows.length} logistics orders into Postgres.`);
  console.log(`Max order_date: ${rows.reduce((max, row) => (row.order_date > max ? row.order_date : max), "")}`);
  console.log(`Status counts: ${JSON.stringify(statusCounts)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
