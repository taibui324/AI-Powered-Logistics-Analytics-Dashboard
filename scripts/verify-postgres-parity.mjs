import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

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
    // Env files are optional.
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

function csvProfile(csv) {
  const [headerLine, ...lines] = csv.trim().split(/\r?\n/);
  const headers = splitCsvLine(headerLine);
  const statusIndex = headers.indexOf("status");
  const orderDateIndex = headers.indexOf("order_date");
  const profile = { rowCount: 0, maxOrderDate: "", statusCounts: {} };

  for (const line of lines.filter(Boolean)) {
    const cells = splitCsvLine(line);
    profile.rowCount += 1;
    const status = cells[statusIndex];
    const orderDate = cells[orderDateIndex];
    profile.statusCounts[status] = (profile.statusCounts[status] ?? 0) + 1;
    if (orderDate > profile.maxOrderDate) profile.maxOrderDate = orderDate;
  }
  return profile;
}

function assertEqual(name, actual, expected) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`${name} mismatch: expected ${expectedJson}, got ${actualJson}`);
  }
}

function sortObjectByKey(value) {
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
}

async function main() {
  loadEnvFile(resolve(process.cwd(), ".env.local"));
  loadEnvFile(resolve(process.cwd(), ".env"));

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for Postgres parity verification.");
  }

  const expected = csvProfile(readFileSync(resolve(process.cwd(), "data/logistics.csv"), "utf8"));
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.POSTGRES_SSL === "false" ? false : { rejectUnauthorized: false }
  });

  try {
    const [{ rows: totals }, { rows: statuses }] = await Promise.all([
      pool.query("select count(*)::int as row_count, max(order_date)::text as max_order_date from public.logistics_orders"),
      pool.query("select status, count(*)::int as count from public.logistics_orders group by status order by status")
    ]);
    const actual = {
      rowCount: totals[0].row_count,
      maxOrderDate: totals[0].max_order_date,
      statusCounts: Object.fromEntries(statuses.map((row) => [row.status, row.count]))
    };

    assertEqual("row count", actual.rowCount, expected.rowCount);
    assertEqual("max order_date", actual.maxOrderDate, expected.maxOrderDate);
    assertEqual("status counts", sortObjectByKey(actual.statusCounts), sortObjectByKey(expected.statusCounts));
    console.log(`Postgres parity verified: ${actual.rowCount} rows, max order_date ${actual.maxOrderDate}.`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
