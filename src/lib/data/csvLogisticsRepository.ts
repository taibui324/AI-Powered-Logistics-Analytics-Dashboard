import { readFile } from "node:fs/promises";
import path from "node:path";
import { DashboardFilters, LogisticsOrder } from "@/lib/analytics/types";
import { applyFilters } from "@/lib/analytics/dashboard";
import { parseLogisticsCsv } from "./csv";
import { LogisticsRepository } from "./logisticsRepository";

let cache: LogisticsOrder[] | null = null;

async function readCsvOrders() {
  if (!cache) {
    const csv = await readFile(path.join(process.cwd(), "data/logistics.csv"), "utf8");
    cache = parseLogisticsCsv(csv);
  }
  return cache;
}

export const csvLogisticsRepository: LogisticsRepository = {
  async listOrders(filters: DashboardFilters = {}) {
    const rows = await readCsvOrders();
    return Object.keys(filters).length ? applyFilters(rows, filters) : rows;
  }
};
