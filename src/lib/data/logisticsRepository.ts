import { DashboardFilters, LogisticsOrder } from "@/lib/analytics/types";

export type LogisticsRepository = {
  listOrders(filters?: DashboardFilters): Promise<LogisticsOrder[]>;
};

export function requireServerEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function shouldUsePostgres() {
  const source = process.env.LOGISTICS_DATA_SOURCE?.toLowerCase();
  if (source === "postgres") return true;
  if (source === "csv") return false;
  return Boolean(process.env.DATABASE_URL);
}
