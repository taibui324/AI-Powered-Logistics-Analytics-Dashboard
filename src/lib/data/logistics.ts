import { DashboardFilters } from "@/lib/analytics/types";
import { csvLogisticsRepository } from "./csvLogisticsRepository";
import { LogisticsRepository, shouldUseSupabase } from "./logisticsRepository";
import { createSupabaseLogisticsRepository } from "./supabaseLogisticsRepository";

let repository: LogisticsRepository | null = null;

export function getLogisticsRepository() {
  if (!repository) {
    repository = shouldUseSupabase() ? createSupabaseLogisticsRepository() : csvLogisticsRepository;
  }
  return repository;
}

export function resetLogisticsRepositoryForTests() {
  repository = null;
}

export async function loadLogisticsOrders(filters: DashboardFilters = {}) {
  return getLogisticsRepository().listOrders(filters);
}
