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

export function shouldUseSupabase() {
  const source = process.env.LOGISTICS_DATA_SOURCE?.toLowerCase();
  if (source === "supabase") return true;
  if (source === "csv") return false;
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
}
