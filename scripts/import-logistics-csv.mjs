import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

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

function parseCsv(csv) {
  const [headerLine, ...lines] = csv.trim().split(/\r?\n/);
  const headers = splitCsvLine(headerLine);
  if (headers.join(",") !== HEADERS.join(",")) {
    throw new Error("Unexpected logistics CSV header");
  }

  return lines.filter(Boolean).map((line) => {
    const values = splitCsvLine(line);
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
      quantity: Number(row.quantity),
      unit_price_usd: Number(row.unit_price_usd),
      order_value_usd: Number(row.order_value_usd),
      is_promo: row.is_promo === "1",
      promo_discount_pct: Number(row.promo_discount_pct),
      region: row.region,
      warehouse: row.warehouse
    };
  });
}

async function main() {
  loadEnvFile(resolve(process.cwd(), ".env.local"));
  loadEnvFile(resolve(process.cwd(), ".env"));

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for import.");
  }

  const csvPath = resolve(process.cwd(), process.argv[2] ?? "data/logistics.csv");
  const rows = parseCsv(readFileSync(csvPath, "utf8"));
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  for (let index = 0; index < rows.length; index += 100) {
    const chunk = rows.slice(index, index + 100);
    const { error } = await supabase.from("logistics_orders").upsert(chunk, { onConflict: "order_id" });
    if (error) {
      throw new Error(`Failed to import rows ${index + 1}-${index + chunk.length}: ${error.message}`);
    }
  }

  const statusCounts = rows.reduce((counts, row) => {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
    return counts;
  }, {});

  console.log(`Imported ${rows.length} logistics orders into Supabase.`);
  console.log(`Max order_date: ${rows.reduce((max, row) => (row.order_date > max ? row.order_date : max), "")}`);
  console.log(`Status counts: ${JSON.stringify(statusCounts)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
